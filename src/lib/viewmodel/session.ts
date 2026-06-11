import type { SessionStats } from "@/lib/types";

const toMinutes = (seconds: number): number => Math.round(seconds / 60);

export function toSessionStats(input: {
  todaySeconds: number;
  weekSeconds: number;
  allTimeSeconds: number;
  streakDays: number;
}): SessionStats {
  return {
    todayMinutes: toMinutes(input.todaySeconds),
    weekMinutes: toMinutes(input.weekSeconds),
    allTimeMinutes: toMinutes(input.allTimeSeconds),
    streakDays: input.streakDays,
  };
}

/**
 * Day-streak from the activity-by-day rollup: count consecutive days back from
 * today (or yesterday) that have at least one activity row.
 */
export function streakFromDays(
  days: ReadonlyArray<{ date: string; count: number }>,
  now: Date,
): number {
  const active = new Set(days.filter((d) => d.count > 0).map((d) => d.date));
  if (active.size === 0) return 0;

  const key = (d: Date) =>
    `${d.getUTCFullYear()}-${`${d.getUTCMonth() + 1}`.padStart(2, "0")}-${`${d.getUTCDate()}`.padStart(2, "0")}`;

  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Allow the streak to "start" yesterday if today has no activity yet.
  if (!active.has(key(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);

  let streak = 0;
  while (active.has(key(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
