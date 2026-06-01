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
