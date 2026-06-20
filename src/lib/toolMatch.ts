import { deltaE2000Hex } from "@/lib/tools/match/deltaE";
import type { MatchResult, Paint } from "@/lib/types";

/**
 * Real colour-matching for the kit's tools — replaces the prototype's
 * hue-distance heuristic with perceptual CIEDE2000 (Lab space), so a target
 * matches paints that actually look like it (not just same-hue greys). Pure +
 * client-safe; operates on the kit's Paint pool.
 */

/** Single closest paint to an arbitrary hex by CIEDE2000. */
export function closestPaint(hex: string, pool: Paint[]): Paint | null {
  let best: Paint | null = null;
  let bestD = Infinity;
  for (const p of pool) {
    const d = deltaE2000Hex(hex, p.hex);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Ranked CIEDE2000 matches to a hex across brands, optionally brand-filtered. */
export function rankMatches(
  hex: string,
  pool: Paint[],
  brand?: string,
  n = 8,
): MatchResult[] {
  return pool
    .filter((p) => !brand || p.brand === brand)
    .map((p) => ({ paint: p, distanceScore: deltaE2000Hex(hex, p.hex) }))
    .sort((a, b) => a.distanceScore - b.distanceScore)
    .slice(0, n);
}

/**
 * Closest paints to a given catalog paint, across ALL brands, excluding the
 * paint itself. CIEDE2000-ranked — the library detail panel's "Match — closest
 * across brands" list. (Replaces the hue-only `mock/derive` heuristic, which
 * ranked greys/black/white as the top match for any saturated colour because
 * they share hue 0 — O9MuXo7ZQdM-.)
 */
export function nearestMatches(target: Paint, pool: Paint[], n = 4): MatchResult[] {
  return pool
    .filter((p) => p.id !== target.id)
    .map((p) => ({ paint: p, distanceScore: deltaE2000Hex(target.hex, p.hex) }))
    .sort((a, b) => a.distanceScore - b.distanceScore)
    .slice(0, n);
}

/** Closest CIEDE2000 equivalents from OTHER brands (excludes self + same brand). */
export function similarInOtherBrands(target: Paint, pool: Paint[], n = 4): Paint[] {
  return pool
    .filter((p) => p.id !== target.id && p.brand !== target.brand)
    .map((p) => ({ p, d: deltaE2000Hex(target.hex, p.hex) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.p);
}

/**
 * Ranked CIEDE2000 matches with a multi-brand filter (empty list = all
 * brands). Powers the Color Match tool's brand chips + pagination (it asks
 * for a large `limit` and pages client-side).
 */
export function rankMatchesMulti(
  hex: string,
  pool: Paint[],
  brands: string[],
  n = 50,
): MatchResult[] {
  const brandSet = brands.length ? new Set(brands) : null;
  return pool
    .filter((p) => !brandSet || brandSet.has(p.brand))
    .map((p) => ({ paint: p, distanceScore: deltaE2000Hex(hex, p.hex) }))
    .sort((a, b) => a.distanceScore - b.distanceScore)
    .slice(0, n);
}
