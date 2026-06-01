import type { ActivityDay } from "@/db/queries/activityLog";
import { toDayKey } from "@/db/queries/activityLog";

/**
 * P14.6 - Pure helpers for the heatmap widget.
 *
 * Pre-bucketing the 90-day grid into cells happens here so the cell
 * component stays mostly visual + the unit tests can pin the cell
 * sequence without rendering.
 */

/**
 * Intensity bucket for one day's activity count.
 *
 *   0   -> "none"      muted / dark
 *   1   -> "low"       light green
 *   2-4 -> "mid"       mid green
 *   5+  -> "high"      bright green
 *
 * Locked thresholds Ross signed off on (P14.6).
 */
export type HeatmapIntensity = "none" | "low" | "mid" | "high";

export function intensityFor(count: number): HeatmapIntensity {
  if (count <= 0) return "none";
  if (count === 1) return "low";
  if (count <= 4) return "mid";
  return "high";
}

/**
 * One cell on the heatmap grid. `date` is the UTC YYYY-MM-DD key
 * the cell represents; `count` is the activity_log row count on
 * that day; `intensity` is the bucketed bin. Cells for days the
 * painter had no activity still get emitted with count 0 so the
 * 90-cell grid is dense.
 */
export interface HeatmapCell {
  date: string;
  count: number;
  intensity: HeatmapIntensity;
}

/**
 * Build the N-cell grid for the heatmap. Cells are emitted oldest-
 * first so the grid reads left-to-right as time advances - matches
 * how every "GitHub-style" heatmap a painter has seen reads.
 *
 *   buildHeatmapCells(days, now, 90)
 *     -> 90 cells, the last of which is `now`.
 */
export function buildHeatmapCells(
  days: ReadonlyArray<ActivityDay>,
  now: Date,
  windowDays: number,
): ReadonlyArray<HeatmapCell> {
  const countByDate = new Map<string, number>();
  for (const d of days) countByDate.set(d.date, d.count);

  const cells: HeatmapCell[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = toDayKey(day);
    const count = countByDate.get(key) ?? 0;
    cells.push({ date: key, count, intensity: intensityFor(count) });
  }
  return cells;
}

/**
 * Month labels for the top row of the grid. Returns the column
 * index (0-based) at which each new month begins, paired with the
 * 3-letter month abbreviation. The first cell always gets a label
 * even mid-month so the painter has a left anchor.
 *
 *   monthLabels(cells)
 *     -> [{ index: 0, label: "Mar" }, { index: 12, label: "Apr" }, ...]
 */
export interface MonthLabel {
  index: number;
  label: string;
}

export function monthLabels(
  cells: ReadonlyArray<HeatmapCell>,
): ReadonlyArray<MonthLabel> {
  const out: MonthLabel[] = [];
  let lastMonth: string | null = null;
  for (let i = 0; i < cells.length; i++) {
    const mm = cells[i]!.date.slice(5, 7);
    if (mm !== lastMonth) {
      out.push({ index: i, label: monthAbbrev(Number(mm)) });
      lastMonth = mm;
    }
  }
  return out;
}

function monthAbbrev(mm1: number): string {
  return [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ][mm1 - 1]!;
}

/**
 * Tooltip text for one cell. "5 activities . Mon 26 May" pattern (the
 * "·" middot in the plan becomes a plain "." here so the title
 * attribute renders cleanly on every browser).
 *
 * UX-1107 — vocabulary aligned with the rest of the dashboard
 * (ACTIVITY widget, activity_log schema, getActivityByDay).
 */
export function tooltipFor(cell: HeatmapCell): string {
  const [y, m, d] = cell.date.split("-").map(Number) as [number, number, number];
  // Build a UTC date to read the weekday so the tooltip aligns with
  // the bucket projection.
  const day = new Date(Date.UTC(y, m - 1, d));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    day.getUTCDay()
  ];
  const monAbbrev = monthAbbrev(m);
  const unit = cell.count === 1 ? "activity" : "activities";
  return cell.count + " " + unit + " . " + weekday + " " + d + " " + monAbbrev;
}
