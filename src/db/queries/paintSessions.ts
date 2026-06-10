import "server-only";

import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { paintSessions, type PaintSession } from "@/db/schema";

/**
 * Phase-14 spillover — paint_sessions read helpers.
 *
 * Three things the FOCUS panel needs to show:
 *   1. The currently-open session (if any) — so a reload mid-paint
 *      resumes the running counter from `startedAt`.
 *   2. Today's total painted time — "1h 47m today" rollup.
 *   3. This week's total painted time — "8h 12m this week" rollup.
 *
 * Both rollups read `duration_seconds` (computed on stop) so an
 * in-progress session does not contribute partial time to the totals
 * — that would flicker as the painter watches. Once stopped, the
 * session lands on the next render.
 */

/** Returns the user's single open session (if any), else null. By
 *  convention there's at most one open session per user — the
 *  startSession action refuses to open a new one if any is already
 *  in-progress. */
export async function getInProgressSession(
  userId: string,
): Promise<PaintSession | null> {
  const rows = await db
    .select()
    .from(paintSessions)
    .where(
      and(eq(paintSessions.userId, userId), isNull(paintSessions.endedAt)),
    )
    .orderBy(desc(paintSessions.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Week-start convention — Monday is the painter-friendly default
 *  (more wargamers paint over a weekend than start a sprint on Sunday). */
function weekStart(ms: number): number {
  const d = new Date(ms);
  // Normalise to local midnight.
  d.setHours(0, 0, 0, 0);
  // Sunday = 0, Monday = 1 ... Saturday = 6. Map back so Monday is the
  // first day of the week.
  const dow = d.getDay();
  const offset = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

function todayStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Sum of `duration_seconds` for completed sessions started on or
 * after `sinceMs`. In-progress sessions (ended_at IS NULL) are
 * excluded — they contribute on stop, not while ticking.
 */
async function rollupSinceMs(userId: string, sinceMs: number): Promise<number> {
  const rows = await db
    .select({
      total: sql<number>`COALESCE(SUM(${paintSessions.durationSeconds}), 0)`,
    })
    .from(paintSessions)
    .where(
      and(
        eq(paintSessions.userId, userId),
        gte(paintSessions.startedAt, new Date(sinceMs)),
      ),
    );
  return Number(rows[0]?.total ?? 0);
}

/**
 * Sum of session seconds for today (local midnight → now). Designed
 * for "1h 47m today" rollup in the FOCUS panel. `now` is injectable
 * for testability — production callers omit it.
 */
export async function getTodayRollupSeconds(
  userId: string,
  now: number = Date.now(),
): Promise<number> {
  return rollupSinceMs(userId, todayStart(now));
}

/**
 * Sum of session seconds for this week (Monday-local-midnight → now).
 * `now` is injectable for testability.
 */
export async function getWeekRollupSeconds(
  userId: string,
  now: number = Date.now(),
): Promise<number> {
  return rollupSinceMs(userId, weekStart(now));
}

/**
 * Cumulative sum of session seconds across ALL of the user's completed
 * sessions (no date floor) — the dashboard's lifetime "TIME TOTAL" KPI.
 * In-progress sessions still don't contribute (rollupSinceMs filters on
 * duration, which is null until stop).
 */
export async function getAllTimeRollupSeconds(userId: string): Promise<number> {
  return rollupSinceMs(userId, 0);
}

/**
 * Convenience helper for the panel: returns both rollups in one
 * round-trip. The dashboard calls this in a Promise.all alongside
 * the rest of the FOCUS data.
 */
export async function getSessionRollups(
  userId: string,
  now: number = Date.now(),
): Promise<{ todaySeconds: number; weekSeconds: number }> {
  const [todaySeconds, weekSeconds] = await Promise.all([
    getTodayRollupSeconds(userId, now),
    getWeekRollupSeconds(userId, now),
  ]);
  return { todaySeconds, weekSeconds };
}

/**
 * Internal helper exposed for tests: list the user's completed
 * sessions older than the given cutoff. Not called from production
 * code paths — the rollup queries are the public surface.
 */
export async function _listCompletedSessionsBefore(
  userId: string,
  beforeMs: number,
): Promise<ReadonlyArray<PaintSession>> {
  return db
    .select()
    .from(paintSessions)
    .where(
      and(
        eq(paintSessions.userId, userId),
        lt(paintSessions.startedAt, new Date(beforeMs)),
      ),
    );
}
