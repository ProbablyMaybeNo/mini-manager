/**
 * `findClosestPaints` — given a target hex and a paint catalog, return
 * the top N closest paints sorted by CIEDE2000 ascending.
 *
 * Used by the Match, Wheel, Eyedropper, and Gradient tools.
 */

import type { Paint } from "@/lib/paints/types";
import { deltaE2000, hexToLab } from "./deltaE";

export type MatchConfidence = "high" | "medium" | "low";

export interface MatchResult {
  paint: Paint;
  /** CIEDE2000 distance. Lower = closer perceptually. */
  deltaE: number;
  confidence: MatchConfidence;
}

export function classifyConfidence(deltaE: number): MatchConfidence {
  if (deltaE < 2) return "high";
  if (deltaE < 5) return "medium";
  return "low";
}

export interface FindOptions {
  /** Cap on returned rows. Default 50. */
  limit?: number;
  /** Optional brand filter — case-sensitive against `paint.brand`. */
  brands?: ReadonlyArray<string>;
  /** Optional paint-type filter — case-sensitive against `paint.type`. */
  types?: ReadonlyArray<string>;
}

/**
 * Sort the catalog by ΔE2000 ascending. Paints with malformed hex are
 * skipped (not pushed to the bottom — the painter doesn't want noise in
 * the top-50 list).
 */
export function findClosestPaints(
  targetHex: string,
  paints: ReadonlyArray<Paint>,
  opts: FindOptions = {},
): MatchResult[] {
  const target = hexToLab(targetHex);
  if (!target) return [];

  const limit = opts.limit ?? 50;
  const brandSet = opts.brands?.length
    ? new Set(opts.brands)
    : null;
  const typeSet = opts.types?.length ? new Set(opts.types) : null;

  const scored: MatchResult[] = [];
  for (const p of paints) {
    if (!p.hex) continue;
    if (brandSet && !brandSet.has(p.brand)) continue;
    if (typeSet && !typeSet.has(p.type)) continue;
    const lab = hexToLab(p.hex);
    if (!lab) continue;
    const d = deltaE2000(target, lab);
    scored.push({
      paint: p,
      deltaE: d,
      confidence: classifyConfidence(d),
    });
  }
  scored.sort((a, b) => a.deltaE - b.deltaE);
  return scored.slice(0, limit);
}
