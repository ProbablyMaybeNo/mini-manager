"use server";

import { revalidatePath } from "next/cache";
import { and, count as countFn, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { paintSessions, projects } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { logActivity } from "@/lib/activityLog";
import { trackFirst } from "@/lib/analytics/track.server";
import { AnalyticsEvent } from "@/lib/analytics/events";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Phase-14 spillover — Stopwatch server actions.
 *
 *   - startSession  → opens a new paint_sessions row (ended_at = null).
 *                     Refuses if any other session for the user is
 *                     already open (one-active-session invariant).
 *   - pauseSession  → stamps the pause start (kept in memory via the
 *                     client's pausedMs accumulator and committed back
 *                     on resume).
 *   - resumeSession → adds the elapsed pause time to paused_ms.
 *   - endSession    → stamps ended_at, computes duration_seconds,
 *                     emits an activity_log row of kind 'paint_session'.
 *
 * The client owns the live counter (setInterval + useRef) — these
 * actions only persist the lifecycle transitions. Computing
 * `duration_seconds` server-side keeps the rollup totals authoritative
 * even if the client clock drifts.
 */

const projectIdSchema = z.string().min(1).max(32);
const sessionIdSchema = z.string().min(1).max(64);
const positiveIntSchema = z.number().int().min(0).max(7 * 24 * 60 * 60 * 1000);

const startSchema = z.object({ projectId: projectIdSchema });
const pauseSchema = z.object({ sessionId: sessionIdSchema });
const resumeSchema = z.object({
  sessionId: sessionIdSchema,
  /** Milliseconds the session was paused this round (since the last
   *  pause click on the client). Added to the persisted paused_ms. */
  addPausedMs: positiveIntSchema,
});
const endSchema = z.object({
  sessionId: sessionIdSchema,
  /** Optional client-supplied extra pause time accumulated since the
   *  last resume — for the "stopped while paused" case. */
  addPausedMs: positiveIntSchema.optional(),
});

export async function startSession(
  raw: z.infer<typeof startSchema>,
): Promise<ActionResult<{ sessionId: string; startedAt: number }>> {
  const parsed = startSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid project",
    };
  }
  const userId = await currentUserId();
  const { projectId } = parsed.data;

  // Verify the project is owned by the caller.
  const owned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  if (!owned[0]) return { ok: false, error: "Project not found" };

  // One-active-session invariant — refuse if anything is open.
  const open = await db
    .select({ id: paintSessions.id })
    .from(paintSessions)
    .where(
      and(eq(paintSessions.userId, userId), isNull(paintSessions.endedAt)),
    )
    .limit(1);
  if (open[0]) {
    return {
      ok: false,
      error: "A session is already running — stop it before starting another.",
    };
  }

  const now = new Date();
  try {
    const inserted = await db
      .insert(paintSessions)
      .values({
        userId,
        projectId,
        startedAt: now,
        pausedMs: 0,
      })
      .returning({ id: paintSessions.id });
    const sessionId = inserted[0]?.id;
    if (!sessionId) {
      return { ok: false, error: "Failed to open session" };
    }

    // Funnel: first focus/paint session = a strong activation signal.
    const [sessionCount] = await db
      .select({ n: countFn() })
      .from(paintSessions)
      .where(eq(paintSessions.userId, userId));
    await trackFirst(sessionCount?.n ?? 0, AnalyticsEvent.FirstFocusSession);

    revalidatePath("/dashboard");
    return {
      ok: true,
      data: { sessionId, startedAt: now.getTime() },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to open session",
    };
  }
}

/**
 * Pause is currently a no-op server-side — the client tracks the
 * pause start in memory and commits the accumulated pause time on
 * resume / stop. We expose the action shape so future iterations
 * can move the pause clock server-side if needed (e.g. cross-device
 * pause sync).
 */
export async function pauseSession(
  raw: z.infer<typeof pauseSchema>,
): Promise<ActionResult<{ sessionId: string }>> {
  const parsed = pauseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid session" };
  }
  const userId = await currentUserId();
  const { sessionId } = parsed.data;

  // Verify ownership + in-progress state.
  const owned = await db
    .select({ id: paintSessions.id })
    .from(paintSessions)
    .where(
      and(
        eq(paintSessions.id, sessionId),
        eq(paintSessions.userId, userId),
        isNull(paintSessions.endedAt),
      ),
    )
    .limit(1);
  if (!owned[0]) return { ok: false, error: "Session not found" };
  return { ok: true, data: { sessionId } };
}

export async function resumeSession(
  raw: z.infer<typeof resumeSchema>,
): Promise<ActionResult<{ sessionId: string }>> {
  const parsed = resumeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid resume payload" };
  }
  const userId = await currentUserId();
  const { sessionId, addPausedMs } = parsed.data;

  const rows = await db
    .select()
    .from(paintSessions)
    .where(
      and(
        eq(paintSessions.id, sessionId),
        eq(paintSessions.userId, userId),
        isNull(paintSessions.endedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, error: "Session not found" };

  try {
    await db
      .update(paintSessions)
      .set({ pausedMs: row.pausedMs + addPausedMs })
      .where(eq(paintSessions.id, sessionId));
    return { ok: true, data: { sessionId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to resume session",
    };
  }
}

export async function endSession(
  raw: z.infer<typeof endSchema>,
): Promise<
  ActionResult<{ sessionId: string; durationSeconds: number }>
> {
  const parsed = endSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid stop payload" };
  }
  const userId = await currentUserId();
  const { sessionId, addPausedMs } = parsed.data;

  const rows = await db
    .select()
    .from(paintSessions)
    .where(
      and(
        eq(paintSessions.id, sessionId),
        eq(paintSessions.userId, userId),
        isNull(paintSessions.endedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, error: "Session not found" };

  const endedAt = new Date();
  const totalPausedMs = row.pausedMs + (addPausedMs ?? 0);
  const elapsedMs = endedAt.getTime() - row.startedAt.getTime() - totalPausedMs;
  const durationSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

  try {
    await db
      .update(paintSessions)
      .set({
        endedAt,
        durationSeconds,
        pausedMs: totalPausedMs,
      })
      .where(eq(paintSessions.id, sessionId));
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to stop session",
    };
  }

  // Emit activity row on STOP only — start would clutter the stream.
  await logActivity(userId, "paint_session", row.projectId);

  revalidatePath("/dashboard");
  return { ok: true, data: { sessionId, durationSeconds } };
}

/**
 * REBUILD — log a completed painting session of a fixed duration (the
 * redesign's Focus stopwatch reports elapsed seconds on LOG). Inserts a
 * closed paint_sessions row so the dashboard time totals + streak pick it up.
 */
export async function logSession(
  raw: { projectId: string; seconds: number },
): Promise<ActionResult<{ sessionId: string }>> {
  const schema = z.object({
    projectId: z.string().min(1).max(32),
    seconds: z.number().int().min(1).max(86_400),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid session" };
  const userId = await currentUserId();
  const { projectId, seconds } = parsed.data;

  const owner = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  if (!owner[0]) return { ok: false, error: "Project not found" };

  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - seconds * 1000);
  const inserted = await db
    .insert(paintSessions)
    .values({
      userId,
      projectId,
      startedAt,
      endedAt,
      durationSeconds: seconds,
      pausedMs: 0,
    })
    .returning({ id: paintSessions.id });
  const sessionId = inserted[0]?.id;
  if (!sessionId) return { ok: false, error: "Failed to log session" };

  await logActivity(userId, "paint_session", projectId);
  revalidatePath("/focus");
  revalidatePath("/dashboard");
  return { ok: true, data: { sessionId } };
}
