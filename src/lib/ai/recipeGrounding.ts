import "server-only";

import type { Paint } from "@/lib/paints/types";
import { hexToHsl } from "@/lib/paints/hue";
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
/**
 * Hue windows per colour family, matching the library filter's own buckets so
 * "blue" means the same thing to the AI as it does to the filter checkboxes.
 */
const COLOUR_HUES: Record<string, [number, number]> = {
  red: [345, 15],
  orange: [15, 45],
  yellow: [45, 70],
  green: [70, 165],
  cyan: [165, 200],
  blue: [200, 260],
  purple: [260, 300],
  magenta: [300, 345],
};

/**
 * Colour words a painter actually types, mapped onto those families. Faction
 * names carry colour intent as reliably as the colour word itself — someone
 * asking for Ultramarines means blue whether or not they say "blue".
 */
const COLOUR_WORDS: Array<[RegExp, string[]]> = [
  [/blue|azure|cobalt|navy|ultramarine|alaitoc|nurgle.?rot/, ["blue"]],
  [/red|crimson|scarlet|blood|khorne|mephiston|word bearer/, ["red"]],
  [/green|jade|emerald|caliban|goblin|orky?|waaagh|salamander/, ["green"]],
  [/yellow|gold(en)?|imperial fist|ochre/, ["yellow"]],
  [/orange|rust|amber|magma/, ["orange"]],
  [/purple|violet|magenta|slaanesh|emperor.?s children/, ["purple", "magenta"]],
  [/cyan|teal|turquoise|aqua/, ["cyan"]],
  [/bone|ivory|cream|white|pale/, ["yellow"]],
  [/black|dark|grim(dark)?|shadow|night lord/, []],
  [/brown|leather|earth|wood|tan/, ["orange"]],
];

/** Colour families the command implies, in the order they were mentioned. */
export function parseColourIntent(command: string): string[] {
  const haystack = command.toLowerCase();
  const out: string[] = [];
  for (const [re, families] of COLOUR_WORDS) {
    if (!re.test(haystack)) continue;
    for (const f of families) if (!out.includes(f)) out.push(f);
  }
  return out;
}

function inHueRange(hue: number, [min, max]: [number, number]): boolean {
  const h = ((hue % 360) + 360) % 360;
  return min > max ? h >= min || h < max : h >= min && h < max;
}

/** True when the paint sits in any of the requested colour families. */
function matchesColourIntent(paint: Paint, families: readonly string[]): boolean {
  if (!families.length) return false;
  const hsl = hexToHsl(paint.hex);
  if (!hsl) return false;
  return families.some((f) => {
    const range = COLOUR_HUES[f];
    return range ? inHueRange(hsl.h, range) : false;
  });
}

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

  // Colour-first ordering (2026-08-02). The round-robin below spreads picks
  // across paint TYPES so every role has something to use, but it was ordered
  // by id — i.e. blind to what was actually asked for. Asking for
  // "Ultramarines, Citadel paints" sent the model 120 candidates containing
  // exactly ONE blue out of the 68 blues Citadel has in the catalog, so it
  // either rationalised a red into the scheme ("Khorne Red serves as deep blue
  // substitute") or invented ids that grounding then dropped, surfacing as
  // "The AI couldn't ground its picks to real paints".
  //
  // Sorting each type's bucket so requested colours come first keeps the type
  // spread intact while guaranteeing the asked-for hues survive the cut.
  const families = parseColourIntent(command);
  const rank = new Map<string, number>();
  for (const p of pool) rank.set(p.id, matchesColourIntent(p, families) ? 0 : 1);

  // Group by type, then round-robin so every type gets representation.
  const byType = new Map<string, Paint[]>();
  for (const p of pool) {
    const arr = byType.get(p.type) ?? [];
    arr.push(p);
    byType.set(p.type, arr);
  }
  // Requested colours first, then id — deterministic either way.
  for (const arr of byType.values())
    arr.sort(
      (a, b) => (rank.get(a.id)! - rank.get(b.id)!) || a.id.localeCompare(b.id),
    );

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
 * Remove our internal catalog ids from human-facing prose.
 *
 * The prompt hands the model lines like `- 15157 | AK Interactive | …`, and it
 * helpfully echoes those ids back into `techniqueNotes` — "prime with
 * Grey-green (15157)". A painter reads that as a product code they can search
 * for. It is meaningless outside this database, and it looks authoritative
 * precisely because it is shaped like a real manufacturer code.
 *
 * Deliberately NOT a blind `\(\d+\)` strip: paint names and notes legitimately
 * carry numbers — kit years like "Infernus Squad (2023)", ratios, "(2 thin
 * coats)". We only remove a parenthesised number when it is **actually an id in
 * the catalog we just fed the model**, which makes a false positive impossible.
 */
function stripCatalogIds(text: string, byId: ReadonlyMap<string, unknown>): string {
  if (!text) return text;
  return text
    .replace(/\s*\((\d{2,8})\)/g, (whole, digits: string) =>
      byId.has(digits) ? "" : whole,
    )
    .replace(/\bid[:=]\s*(\d{2,8})\b/gi, (whole, digits: string) =>
      byId.has(digits) ? "" : whole,
    )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:])/g, "$1")
    .trim();
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
    // Coerce before matching. The model is untrusted input: it has been seen
    // returning `"id:16162"` — the literal token from the candidate list's own
    // formatting — which failed the exact-match lookup and dropped every slot,
    // surfacing to the user as "couldn't ground its picks to real paints"
    // (2026-08-02). A number is equally plausible from a JSON tool call.
    // Normalising here is defence in depth, not a substitute for the prompt
    // fix in recipeAi.ts: an id that still doesn't resolve is dropped exactly
    // as before, so the anti-hallucination guarantee is unchanged.
    const rawId = rawSlot?.paintId;
    const paintId =
      typeof rawId === "string"
        ? rawId.trim().replace(/^id[:=]\s*/i, "")
        : typeof rawId === "number"
          ? String(rawId)
          : "";
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
      note: stripCatalogIds(
        typeof rawSlot?.note === "string" ? rawSlot.note.slice(0, 500) : "",
        byId,
      ),
      owned,
    });
  }

  return {
    summary: stripCatalogIds(
      typeof raw?.summary === "string" ? raw.summary.slice(0, 600) : "",
      byId,
    ),
    techniqueNotes: stripCatalogIds(
      typeof raw?.techniqueNotes === "string" ? raw.techniqueNotes.slice(0, 4000) : "",
      byId,
    ),
    slots,
    droppedPaintIds,
    missingPaintIds,
  };
}
