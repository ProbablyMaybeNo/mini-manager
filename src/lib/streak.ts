import type { ActivityDay } from "@/db/queries/activityLog";
import { toDayKey } from "@/db/queries/activityLog";

/**
 * P14.5 - Pure helpers for the streak counter widget.
 *
 * Lives outside PlannerStreakCell.tsx so unit tests can import them
 * in node env without next-auth (same pattern as
 * plannerActivityHelpers.ts).
 */

/** A row counts toward the streak when it's a stage_bump OR a
 *  recipe_created. paint_added / project_created / slot_added are
 *  too noisy / too one-off to qualify. */
export function dayHasStreakActivity(day: ActivityDay): boolean {
  return day.kinds.some(
    (k) => k === "stage_bump" || k === "recipe_created",
  );
}

/**
 * Result of the streak computation. `streak` is the consecutive-
 * days count from today backwards. `daysSinceLast` is null when
 * the painter has zero streak-qualifying activity ever; otherwise
 * it's the number of days since the most recent qualifying day
 * (0 = today, 1 = yesterday, ...).
 */
export interface StreakResult {
  streak: number;
  daysSinceLast: number | null;
}

/**
 * Compute the consecutive-day streak from a list of ActivityDay
 * rows (newest first) and a "today" anchor date.
 *
 * Rules:
 *   1. A day counts toward the streak when it has at least one
 *      stage_bump or recipe_created row.
 *   2. The streak is the longest run of qualifying days ending
 *      either today or yesterday. If the painter painted today,
 *      yesterday's qualification is checked next; if they didn't
 *      paint today, we start at yesterday so a streak doesn't
 *      reset just because the painter hasn't yet sat down today.
 *   3. A gap of one or more non-qualifying days breaks the streak.
 *
 * `daysSinceLast` returns the gap (in days) from `today` to the
 * most recent qualifying day, irrespective of whether that day is
 * inside the current run. null when there is no qualifying day
 * in the input.
 */
export function computeStreak(
  daysNewestFirst: ReadonlyArray<ActivityDay>,
  today: Date,
): StreakResult {
  const todayKey = toDayKey(today);
  const qualifying = daysNewestFirst.filter(dayHasStreakActivity);
  if (qualifying.length === 0) {
    return { streak: 0, daysSinceLast: null };
  }

  const mostRecentKey = qualifying[0]!.date;
  const daysSinceLast = dayDiff(todayKey, mostRecentKey);

  // Streak anchor: "today" if the painter qualified today, else
  // "yesterday" (so a fresh morning before painting still shows
  // yesterday's streak intact).
  const qualifyingSet = new Set(qualifying.map((d) => d.date));
  let anchorKey: string;
  if (qualifyingSet.has(todayKey)) {
    anchorKey = todayKey;
  } else {
    anchorKey = shiftDay(todayKey, -1);
  }

  let streak = 0;
  let cursor = anchorKey;
  while (qualifyingSet.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }

  return { streak, daysSinceLast };
}

/**
 * Pick the microcopy line for a streak result. Order matters: an
 * active 7+ streak takes the strongest framing; a fresh streak gets
 * the "don't break the chain" nudge; a broken-but-recent streak
 * gets the "break it open" come-back nudge; the never-painted
 * state gets the empty-state CTA.
 */
export function microcopyFor(result: StreakResult): string {
  if (result.streak >= 7) {
    return "On a " + result.streak + "-day painting streak — keep it up.";
  }
  if (result.streak >= 1) {
    const unit = result.streak === 1 ? "day" : "days";
    return result.streak + " " + unit + " — don't break the chain.";
  }
  if (result.daysSinceLast !== null && result.daysSinceLast <= 3) {
    const unit = result.daysSinceLast === 1 ? "day" : "days";
    return (
      "Last paint: " +
      result.daysSinceLast +
      " " +
      unit +
      " ago — break it open."
    );
  }
  return "Bump a stage to start your streak.";
}

/**
 * DASH-STREAK-BASELINE (2026-06-05) — the streak's third context layer.
 *
 * A raw streak number is uninterpretable without a baseline (doc §8: a
 * KPI needs a temporal comparison + a benchmark). This derives two from
 * the SAME activity_log window already fetched for the streak:
 *   - `bestStreak`   — the longest run of consecutive qualifying days
 *                      anywhere in the window (the all-time-within-window
 *                      benchmark to beat).
 *   - `thisWeek` /
 *     `lastWeek`     — count of qualifying (painting) days in the current
 *                      vs previous 7-day window (the WoW temporal trend).
 *
 * Everything is computed from the same `dayHasStreakActivity` predicate
 * the streak uses, so "a painting day" means the same thing in both.
 */
export interface StreakBaseline {
  bestStreak: number;
  thisWeek: number;
  lastWeek: number;
}

export function computeStreakBaseline(
  daysNewestFirst: ReadonlyArray<ActivityDay>,
  today: Date,
): StreakBaseline {
  const qualifyingSet = new Set(
    daysNewestFirst.filter(dayHasStreakActivity).map((d) => d.date),
  );

  // Longest consecutive run anywhere in the window. Walk each qualifying
  // day; a day starts a run only when the day before it is NOT qualifying.
  let bestStreak = 0;
  for (const key of qualifyingSet) {
    if (qualifyingSet.has(shiftDay(key, -1))) continue; // not a run start
    let len = 0;
    let cursor = key;
    while (qualifyingSet.has(cursor)) {
      len += 1;
      cursor = shiftDay(cursor, 1);
    }
    if (len > bestStreak) bestStreak = len;
  }

  // WoW painting-day counts. `today` anchors the current 7-day window
  // (days 0..6 back); the prior window is days 7..13 back.
  const todayKey = toDayKey(today);
  let thisWeek = 0;
  let lastWeek = 0;
  for (let i = 0; i < 14; i += 1) {
    const key = shiftDay(todayKey, -i);
    if (!qualifyingSet.has(key)) continue;
    if (i < 7) thisWeek += 1;
    else lastWeek += 1;
  }

  return { bestStreak, thisWeek, lastWeek };
}

/**
 * One-line baseline string for the streak KPI's third context layer.
 * Pairs the WoW painting-day trend with the best-streak benchmark.
 * Returns null when there's no qualifying history at all (a brand-new
 * painter gets no misleading "0 vs 0" line — the KPI shows the number
 * alone until there's something to compare against).
 */
export function streakBaselineLine(baseline: StreakBaseline): string | null {
  if (
    baseline.bestStreak === 0 &&
    baseline.thisWeek === 0 &&
    baseline.lastWeek === 0
  ) {
    return null;
  }
  const trend =
    baseline.thisWeek > baseline.lastWeek
      ? "▲"
      : baseline.thisWeek < baseline.lastWeek
        ? "▼"
        : "■";
  return (
    `${trend} ${baseline.thisWeek} this wk vs ${baseline.lastWeek} last` +
    ` · best ${baseline.bestStreak}`
  );
}

/**
 * Days between two YYYY-MM-DD keys. Positive when `later` is after
 * `earlier`. Computed in UTC to match toDayKey's projection.
 */
function dayDiff(later: string, earlier: string): number {
  const laterMs = Date.UTC(
    Number(later.slice(0, 4)),
    Number(later.slice(5, 7)) - 1,
    Number(later.slice(8, 10)),
  );
  const earlierMs = Date.UTC(
    Number(earlier.slice(0, 4)),
    Number(earlier.slice(5, 7)) - 1,
    Number(earlier.slice(8, 10)),
  );
  return Math.round((laterMs - earlierMs) / (24 * 60 * 60 * 1000));
}

/**
 * Shift a YYYY-MM-DD key by N days (positive = later). UTC math
 * so leap-year + DST jumps don't break the boundary.
 */
function shiftDay(key: string, delta: number): string {
  const ms = Date.UTC(
    Number(key.slice(0, 4)),
    Number(key.slice(5, 7)) - 1,
    Number(key.slice(8, 10)),
  );
  const shifted = new Date(ms + delta * 24 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}
