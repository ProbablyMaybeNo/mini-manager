import type { Project } from "@/db/schema";
import { displayStatus, progressPercent } from "@/lib/progress";

/**
 * DASH-KPI (2026-06-05) — pure helpers for the top KPI strip.
 *
 * Lives outside the server cell so the maths is unit-testable in a node
 * env without the db client / next-auth (same split as
 * plannerStreakHelpers.ts). Every metric is derived from data the
 * dashboard ALREADY fetches or from existing query helpers — no new
 * tracking infrastructure.
 *
 * Doc §4/§8: the strip is the inverted-pyramid's headline layer. Each
 * number needs to be glanceable + decision-relevant, lead card top-left.
 */

/** Minimal project shape the KPI maths needs — every field is already on
 *  the rows the dashboard pulls via `listAllProjects`. */
export type KpiProject = Pick<
  Project,
  | "parentId"
  | "count"
  | "ownedCount"
  | "buildCount"
  | "primeCount"
  | "paintCount"
  | "baseCount"
  | "completeCount"
  | "isShelved"
>;

/**
 * Count of "active" projects — the ones the painter is mid-stream on.
 *
 * Definition: a top-level project (parentId === null, so an Army/Warband
 * counts once, not once-per-child) that holds real miniatures
 * (`count > 0`), isn't shelved, and isn't fully COMPLETE. This is the
 * "how many balls am I juggling" number — the lead, most-decision-
 * relevant KPI, so it sits top-left.
 */
export function activeProjectCount(
  projects: ReadonlyArray<KpiProject>,
): number {
  return projects.filter((p) => {
    if (p.parentId) return false;
    if (p.count === 0) return false;
    const status = displayStatus(p);
    return status !== "SHELVED" && status !== "COMPLETE" && status !== "WISHLIST";
  }).length;
}

/**
 * Average completion % across every project that holds miniatures
 * (`count > 0`). Containers with no models of their own (count === 0)
 * are excluded so an Army parent doesn't drag the average to 0 — its
 * progress is already represented by its child Units' rows. Returns an
 * integer 0–100; 0 when there are no model-bearing projects.
 */
export function averageCompletion(
  projects: ReadonlyArray<KpiProject>,
): number {
  const leaves = projects.filter((p) => p.count > 0);
  if (leaves.length === 0) return 0;
  const sum = leaves.reduce((acc, p) => acc + progressPercent(p), 0);
  return Math.round(sum / leaves.length);
}

/**
 * Format a session-seconds total as a compact `Xh Ym` / `Ym` string for
 * the KPI's big number. Mirrors the FOCUS panel's "8h 12m this week"
 * rollup phrasing. Returns the value + unit split so the cell can render
 * the number big and the unit small.
 */
export function formatPaintTime(seconds: number): {
  value: string;
  unit: string;
} {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return { value: `${hours}h ${minutes}m`, unit: "this week" };
  }
  return { value: `${minutes}m`, unit: "this week" };
}
