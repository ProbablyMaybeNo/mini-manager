import type { Project } from "@/db/schema";
import type { ActivityDay } from "@/db/queries/activityLog";
import { toDayKey } from "@/db/queries/activityLog";
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

/**
 * DASHBOARD-REDESIGN (Part B item 1) — format a session-seconds total as a
 * zero-padded `HH:MM` clock string for the TIME TOTAL KPI card (the mockup's
 * `05:47`). The KPI cards show ONLY a big centred number, so the compact
 * clock reads cleaner than the "8h 12m" phrasing. Clamps negatives to 0; the
 * hour field grows past two digits on very long weeks (e.g. `120:05`) so it
 * never silently truncates.
 */
export function formatTimeTotal(seconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * DASHBOARD-REDESIGN (Part B item 1) — zero-pad a small count to two digits
 * for the KPI cards' big numbers (the mockup's `05` / `03`). Counts ≥ 100
 * render verbatim so a large workbench never truncates.
 */
export function padCount(n: number): string {
  const v = Math.max(0, Math.round(n));
  return v < 100 ? String(v).padStart(2, "0") : String(v);
}

/**
 * PHASE-1 viz — dense daily-activity series for the dashboard trend graph
 * (LineGraph / Sparkline). The dashboard already fetches `getActivityByDay`
 * over a 60-day window for the streak; this re-uses that exact data (no new
 * query) and projects it into a gap-filled, fixed-length numeric series
 * for the bespoke viz kit.
 *
 * The input is sparse (only days WITH activity have a row) and newest-
 * first; the viz needs a CONTIGUOUS series oldest→newest so the plot reads
 * left = `days` ago, right = today, with quiet days drawn as zeros (a flat
 * stretch) rather than collapsed out. Returns exactly `days` numbers.
 */
export function activityTrendSeries(
  daysNewestFirst: ReadonlyArray<ActivityDay>,
  today: Date,
  days = 30,
): number[] {
  const span = Math.max(1, Math.round(days));
  const countByKey = new Map<string, number>();
  for (const d of daysNewestFirst) countByKey.set(d.date, d.count);

  const todayMs = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const series: number[] = [];
  // i runs oldest (span-1 days ago) → newest (today) so the plot is
  // chronological left→right.
  for (let i = span - 1; i >= 0; i -= 1) {
    const key = toDayKey(new Date(todayMs - i * 24 * 60 * 60 * 1000));
    series.push(countByKey.get(key) ?? 0);
  }
  return series;
}
