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
