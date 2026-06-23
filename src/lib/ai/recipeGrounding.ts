import "server-only";

import type { Paint } from "@/lib/paints/types";
import {
  ROLE_TO_TECHNIQUE,
  normaliseRole,
  type GroundedRecipeProposal,
  type GroundedSlot,
  type RawRecipeProposal,
} from "./recipeSchema";

/**
 * Grounding + validation for the AI Recipe Creator.
 *
 * The magic — and the safety — is here. The model never free-writes paint
 * names. We:
 *   1. parse the brand(s) it asked for out of the command,
 *   2. hand Claude a CANDIDATE LIST of real catalog paints (filtered to
 *      those brands), and
 *   3. force it (via a strict tool schema) to PICK paintIds from that list
 *      for each recipe role.
 *
 * Then `groundProposal` validates every returned paintId against the catalog
 * and DROPS any that don't resolve — so a hallucinated id can never reach a
 * saved recipe. This module is pure (no network): the network call lives in
 * `recipeAi.ts`, which feeds the model output through `groundProposal`.
 */

/** How many candidate paints we send the model. Big enough to give it real
 *  range across roles, small enough to stay cheap on tokens. */
export const CANDIDATE_LIMIT = 140;
/** Hard cap on slots in a single recipe — defends against a runaway model. */
export const MAX_SLOTS = 12;

/** A trimmed catalog row as sent to the model (id + the fields it reasons on). */
export interface CandidatePaint {
  id: string;
  brand: string;
  line?: string;
  name: string;
  type: string;
  hex: string;
}

/**
 * Pull brand constraints out of a natural-language command by substring-
 * matching known catalog brand names (case-insensitive). Returns the set of
 * brands the command mentions; empty when none are named (caller then sends a
 * broad cross-brand candidate list).
 */
export function parseBrands(command: string, paints: ReadonlyArray<Paint>): string[] {
  const haystack = command.toLowerCase();
  const brands = new Set<string>();
  // Build the brand vocabulary once.
  const allBrands = new Set<string>();
  for (const p of paints) allBrands.add(p.brand);
  for (const brand of allBrands) {
    const b = brand.toLowerCase();
    // Require a reasonably specific token so we don't match "Mr." in prose;
    // a 3+ char brand name appearing verbatim is a deliberate ask.
    if (b.length >= 3 && haystack.includes(b)) brands.add(brand);
  }
  // Common shorthands the catalog spells out in full.
  const aliases: Array<[RegExp, string[]]> = [
    [/\bcitadel\b|\bgw\b|\bgames workshop\b/, ["Citadel"]],
    [/\bvallejo\b/, ["Vallejo Model Color", "Vallejo Game Color"]],
    [/\barmy painter\b|\bwarpaints?\b/, ["The Army Painter"]],
    [/\bscale\s?75\b/, ["Scale75"]],
    [/\bak\b/, ["AK Interactive"]],
  ];
  for (const [re, names] of aliases) {
    if (re.test(haystack)) {
      for (const n of names) if (allBrands.has(n)) brands.add(n);
    }
  }
  return [...brands];
}

/**
 * Build the candidate paint list for the model: filter to requested brands
 * (or all, cross-brand) and cap at CANDIDATE_LIMIT. We spread the cap across
 * paint TYPES (Paint / Wash / Metallic / Contrast / …) so the model has at
 * least some metallics and washes to pick for those roles, not 140 base
 * acrylics. Deterministic ordering keeps the prompt cacheable and tests
 * stable.
 */
export function buildCandidates(
  command: string,
  paints: ReadonlyArray<Paint>,
  limit: number = CANDIDATE_LIMIT,
): { candidates: CandidatePaint[]; brands: string[] } {
  const brands = parseBrands(command, paints);
  const brandSet = brands.length ? new Set(brands) : null;

  const pool = paints.filter((p) => {
    if (!p.hex) return false;
    if (brandSet && !brandSet.has(p.brand)) return false;
    return true;
  });

  // Group by type, then round-robin so every type gets representation.
  const byType = new Map<string, Paint[]>();
  for (const p of pool) {
    const arr = byType.get(p.type) ?? [];
    arr.push(p);
    byType.set(p.type, arr);
  }
  // Stable sort within each type by id so output is deterministic.
  for (const arr of byType.values()) arr.sort((a, b) => a.id.localeCompare(b.id));

  const typeKeys = [...byType.keys()].sort();
  const picked: Paint[] = [];
  let idx = 0;
  while (picked.length < limit) {
    let addedThisRound = 0;
    for (const t of typeKeys) {
      const arr = byType.get(t)!;
      if (idx < arr.length) {
        picked.push(arr[idx]!);
        addedThisRound++;
        if (picked.length >= limit) break;
      }
    }
    if (addedThisRound === 0) break; // pool exhausted
    idx++;
  }

  const candidates: CandidatePaint[] = picked.map((p) => ({
    id: p.id,
    brand: p.brand,
    ...(p.line ? { line: p.line } : {}),
    name: p.name,
    type: p.type,
    hex: p.hex,
  }));
  return { candidates, brands };
}

/**
 * Validate a raw model proposal against the catalog. EVERY returned paintId
 * must resolve to a real catalog row; ones that don't are dropped and
 * recorded in `droppedPaintIds`. Roles are normalised and mapped to DB
 * techniques. Ownership is filled from `ownedPaintIds`.
 *
 * This is the anti-hallucination gate — call it on every model response
 * before anything is shown or saved.
 */
export function groundProposal(
  raw: RawRecipeProposal,
  paints: ReadonlyArray<Paint>,
  ownedPaintIds: ReadonlySet<string>,
): GroundedRecipeProposal {
  const byId = new Map<string, Paint>();
  for (const p of paints) byId.set(p.id, p);

  const slots: GroundedSlot[] = [];
  const droppedPaintIds: string[] = [];
  const missingPaintIds: string[] = [];
  const seen = new Set<string>();

  for (const rawSlot of raw.slots ?? []) {
    if (slots.length >= MAX_SLOTS) break;
    const paintId = typeof rawSlot?.paintId === "string" ? rawSlot.paintId.trim() : "";
    const paint = paintId ? byId.get(paintId) : undefined;
    if (!paint) {
      // Hallucinated or empty id → drop it. NEVER fabricate a paint.
      if (paintId) droppedPaintIds.push(paintId);
      continue;
    }
    // De-dup the same paint appearing twice for the same role.
    const dedupeKey = `${paint.id}:${normaliseRole(rawSlot.role ?? "base")}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const role = normaliseRole(rawSlot.role ?? "base");
    const owned = ownedPaintIds.has(paint.id);
    if (!owned && !missingPaintIds.includes(paint.id)) missingPaintIds.push(paint.id);

    slots.push({
      role,
      layer: ROLE_TO_TECHNIQUE[role],
      paintId: paint.id,
      brand: paint.brand,
      name: paint.name,
      hex: paint.hex,
      note: typeof rawSlot?.note === "string" ? rawSlot.note.slice(0, 500) : "",
      owned,
    });
  }

  return {
    summary: typeof raw?.summary === "string" ? raw.summary.slice(0, 600) : "",
    techniqueNotes:
      typeof raw?.techniqueNotes === "string" ? raw.techniqueNotes.slice(0, 4000) : "",
    slots,
    droppedPaintIds,
    missingPaintIds,
  };
}
