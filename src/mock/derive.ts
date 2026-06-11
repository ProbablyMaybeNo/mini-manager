import { deltaE2000Hex } from "@/lib/tools/match/deltaE";
import type { DashboardSummary, MatchResult, Paint, Project, SessionStats } from "@/lib/types";

/**
 * Host-side derivation (lives in the data layer, NOT in UI components). The host
 * computes these roll-ups + colour matches; the UI only renders the result.
 *
 * Colour matching uses the real perceptual metric (CIEDE2000 in Lab space) via
 * `deltaE2000Hex` — the same engine the Match tool uses — not hue distance.
 */
export function deriveDashboardSummary(
  projects: Project[],
  stats: SessionStats,
): DashboardSummary {
  const active = projects.filter(
    (p) => p.status !== "COMPLETE" && p.status !== "WISHLIST" && p.status !== "SHELVED",
  ).length;

  const completionPercent =
    projects.length === 0
      ? 0
      : Math.round(
          projects.reduce((sum, p) => sum + p.completionPercent, 0) / projects.length,
        );

  return {
    activeProjects: active,
    completionPercent,
    streakDays: stats.streakDays,
    timeTotalMinutes: stats.allTimeMinutes,
  };
}

/** Host-provided ranked matches: closest paints across all brands (excluding self). */
export function nearestMatches(target: Paint, pool: Paint[], n = 4): MatchResult[] {
  return pool
    .filter((p) => p.id !== target.id)
    .map((p) => ({ paint: p, distanceScore: deltaE2000Hex(target.hex, p.hex) }))
    .sort((a, b) => a.distanceScore - b.distanceScore)
    .slice(0, n);
}

/** Single closest paint to an arbitrary hex (real ΔE2000 matching). */
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

/** Ranked matches to an arbitrary hex across brands, optionally brand-filtered. */
export function rankMatches(hex: string, pool: Paint[], brand?: string, n = 8): MatchResult[] {
  return pool
    .filter((p) => !brand || p.brand === brand)
    .map((p) => ({ paint: p, distanceScore: deltaE2000Hex(hex, p.hex) }))
    .sort((a, b) => a.distanceScore - b.distanceScore)
    .slice(0, n);
}

/** Closest equivalents from OTHER brands. */
export function similarInOtherBrands(target: Paint, pool: Paint[], n = 4): Paint[] {
  return pool
    .filter((p) => p.id !== target.id && p.brand !== target.brand)
    .map((p) => ({ p, d: deltaE2000Hex(target.hex, p.hex) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.p);
}
