import type { ProjectType } from "@/db/schema";

/**
 * Quick-add parser. Takes a single user string and infers
 * a project name, count, and type. Used by the QuickAddBar
 * on the projects dashboard.
 *
 * Heuristics:
 *   - Trailing `x10`, `x 20`, `× 20` (any case) → count.
 *   - "army"      → type=Army, count defaults to 0 (parent).
 *   - "warband"   → type=Warband, count defaults to 0 (parent).
 *   - "terrain"   → type=Terrain Piece, count=1.
 *   - "diorama"   → type=Diorama, count=1.
 *   - Has count > 1                          → Unit.
 *   - Single-mini hints ("sergeant", etc.)   → Single Model, count=1.
 *   - Default                                → Single Model, count=1.
 *
 * The matched type/count tokens are stripped from the name. The
 * result is always trimmed and collapsed-whitespace.
 */
export function parseQuickAdd(
  input: string,
): { name: string; count: number; type: ProjectType } {
  let working = input.trim();

  // 1. Extract a trailing count token if present.
  //    Matches: x20, x 20, X 20, ×20, × 20 — at end of string.
  let explicitCount: number | null = null;
  const countMatch = working.match(/[x×]\s*(\d+)\s*$/i);
  if (countMatch && countMatch[1] !== undefined) {
    const parsed = Number.parseInt(countMatch[1], 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      explicitCount = parsed;
      working = working.slice(0, countMatch.index).trim();
    }
  }

  // 2. Look for type hints — strip the matching word from the name.
  const lower = working.toLowerCase();

  let type: ProjectType | null = null;
  let stripPattern: RegExp | null = null;

  if (/\bdiorama\b/.test(lower)) {
    type = "Diorama";
    stripPattern = /\bdiorama\b/i;
  } else if (/\bterrain\b/.test(lower)) {
    type = "Terrain Piece";
    stripPattern = /\bterrain(?:\s+piece)?\b/i;
  } else if (/\bwarband\b/.test(lower)) {
    type = "Warband";
    stripPattern = /\bwarband\b/i;
  } else if (/\barmy\b/.test(lower)) {
    type = "Army";
    stripPattern = /\barmy\b/i;
  } else if (/\b(unit|squad|mob|pack)\b/.test(lower)) {
    type = "Unit";
    // Don't strip these — "Tactical Squad Alpha" should keep "Squad".
  } else if (/\b(single|sergeant|captain|lord|hero|character)\b/.test(lower)) {
    type = "Single Model";
    // Don't strip — "Sergeant Vraks" keeps "Sergeant".
  }

  if (stripPattern) {
    working = working.replace(stripPattern, " ");
  }

  // 3. Decide final count + type defaults.
  let count: number;
  let finalType: ProjectType;

  if (type === "Army" || type === "Warband") {
    finalType = type;
    // Parent containers default to 0 — count overrides if user gave one.
    count = explicitCount ?? 0;
  } else if (type === "Terrain Piece" || type === "Diorama") {
    finalType = type;
    count = explicitCount ?? 1;
  } else if (type === "Single Model") {
    finalType = "Single Model";
    count = 1; // single mini is always 1
  } else if (type === "Unit") {
    finalType = "Unit";
    count = explicitCount ?? 1;
  } else if (explicitCount !== null && explicitCount > 1) {
    // No type hint, but a count > 1 strongly implies a Unit.
    finalType = "Unit";
    count = explicitCount;
  } else {
    finalType = "Single Model";
    count = 1;
  }

  // 4. Clean up name: collapse internal whitespace, trim.
  const name = working.replace(/\s+/g, " ").trim();

  return { name, count, type: finalType };
}
