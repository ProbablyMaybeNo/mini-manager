/**
 * Phase-14 spillover — paint_sessions stopwatch server actions.
 *
 * Covers the lifecycle:
 *   1. startSession    — opens a row (ended_at = null)
 *   2. resumeSession   — bumps paused_ms
 *   3. endSession      — stamps ended_at + duration_seconds, emits
 *                        an activity_log row of kind paint_session
 *   4. getInProgressSession / today + week rollup helpers
 *
 * In-memory libsql per test (migrations applied), auth + revalidatePath
 * mocked so the action contract is observable.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { activityLog, paintSessions, projects } from "@/db/schema";

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  userId: "" as string,
}));

vi.mock("@/db/client", () => ({
  get db() {
    if (!state.db) throw new Error("Test DB not initialised in beforeEach");
    return state.db;
  },
}));

vi.mock("@/lib/auth-stub", () => ({
  currentUserId: async () => state.userId,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const actions = await import("@/lib/actions/paintSessions");
const queries = await import("@/db/queries/paintSessions");

async function seedProject(name = "Test project"): Promise<string> {
  const projectId = nanoid(16);
  await state.db!.insert(projects).values({
    id: projectId,
    ownerId: state.userId,
    type: "Unit",
    name,
    count: 5,
  });
  return projectId;
}

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("startSession — opens a paint_sessions row", () => {
  test("happy path inserts a row with ended_at = null", async () => {
    const projectId = await seedProject();
    const res = await actions.startSession({ projectId });

    expect(res.ok).toBe(true);

    const rows = await state
      .db!.select()
      .from(paintSessions)
      .where(eq(paintSessions.userId, state.userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.endedAt).toBeNull();
    expect(rows[0]?.projectId).toBe(projectId);
    expect(rows[0]?.pausedMs).toBe(0);
  });

  test("refuses to open a second session while one is in-progress", async () => {
    const a = await seedProject("A");
    const b = await seedProject("B");
    const first = await actions.startSession({ projectId: a });
    expect(first.ok).toBe(true);

    const second = await actions.startSession({ projectId: b });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/already running/i);

    // Still only one row.
    const rows = await state.db!.select().from(paintSessions);
    expect(rows).toHaveLength(1);
  });

  test("rejects an unknown project id", async () => {
    const res = await actions.startSession({ projectId: "doesnotexist" });
    expect(res.ok).toBe(false);
  });
});

describe("endSession — stamps ended_at + duration_seconds", () => {
  test("computes duration as (ended - started - pausedMs) / 1000", async () => {
    const projectId = await seedProject();
    const start = await actions.startSession({ projectId });
    if (!start.ok) throw new Error(start.error);

    // Backdate the row's startedAt by exactly 3600s so the duration
    // math is deterministic — we cannot wait an hour in a test.
    const oneHourAgo = new Date(Date.now() - 3_600_000);
    await state
      .db!.update(paintSessions)
      .set({ startedAt: oneHourAgo })
      .where(eq(paintSessions.id, start.data.sessionId));

    const stop = await actions.endSession({ sessionId: start.data.sessionId });
    expect(stop.ok).toBe(true);
    if (!stop.ok) return;
    // Within 5s of one hour.
    expect(stop.data.durationSeconds).toBeGreaterThanOrEqual(3_595);
    expect(stop.data.durationSeconds).toBeLessThanOrEqual(3_605);

    const [row] = await state
      .db!.select()
      .from(paintSessions)
      .where(eq(paintSessions.id, start.data.sessionId));
    expect(row?.endedAt).not.toBeNull();
    expect(row?.durationSeconds).toBe(stop.data.durationSeconds);
  });

  test("emits an activity_log row of kind paint_session on STOP", async () => {
    const projectId = await seedProject();
    const start = await actions.startSession({ projectId });
    if (!start.ok) throw new Error(start.error);
    await actions.endSession({ sessionId: start.data.sessionId });

    const rows = await state
      .db!.select()
      .from(activityLog)
      .where(eq(activityLog.userId, state.userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("paint_session");
    expect(rows[0]?.refId).toBe(projectId);
  });

  test("does NOT emit activity on start (only on stop)", async () => {
    const projectId = await seedProject();
    await actions.startSession({ projectId });

    const rows = await state
      .db!.select()
      .from(activityLog)
      .where(eq(activityLog.userId, state.userId));
    // No paint_session row before stop. Start may have triggered
    // none / something else; we assert no paint_session specifically.
    expect(rows.filter((r) => r.kind === "paint_session")).toHaveLength(0);
  });

  test("subtracts addPausedMs sent at stop time", async () => {
    const projectId = await seedProject();
    const start = await actions.startSession({ projectId });
    if (!start.ok) throw new Error(start.error);

    // Backdate to 10s ago.
    await state
      .db!.update(paintSessions)
      .set({ startedAt: new Date(Date.now() - 10_000) })
      .where(eq(paintSessions.id, start.data.sessionId));

    const stop = await actions.endSession({
      sessionId: start.data.sessionId,
      addPausedMs: 4_000,
    });
    expect(stop.ok).toBe(true);
    if (!stop.ok) return;
    // 10s elapsed - 4s paused = ~6s.
    expect(stop.data.durationSeconds).toBeGreaterThanOrEqual(5);
    expect(stop.data.durationSeconds).toBeLessThanOrEqual(7);
  });

  test("rejects a stop on someone else's session", async () => {
    const projectId = await seedProject();
    const start = await actions.startSession({ projectId });
    if (!start.ok) throw new Error(start.error);

    // Swap user identity mid-flight.
    const original = state.userId;
    state.userId = nanoid(16);
    const res = await actions.endSession({ sessionId: start.data.sessionId });
    expect(res.ok).toBe(false);
    state.userId = original;
  });
});

describe("resumeSession — accumulates paused_ms", () => {
  test("adds addPausedMs to the persisted paused_ms", async () => {
    const projectId = await seedProject();
    const start = await actions.startSession({ projectId });
    if (!start.ok) throw new Error(start.error);

    const r1 = await actions.resumeSession({
      sessionId: start.data.sessionId,
      addPausedMs: 1_500,
    });
    expect(r1.ok).toBe(true);

    const r2 = await actions.resumeSession({
      sessionId: start.data.sessionId,
      addPausedMs: 2_500,
    });
    expect(r2.ok).toBe(true);

    const [row] = await state
      .db!.select()
      .from(paintSessions)
      .where(eq(paintSessions.id, start.data.sessionId));
    expect(row?.pausedMs).toBe(4_000);
  });
});

describe("getInProgressSession — finds an open row for the caller", () => {
  test("returns null when no session is open", async () => {
    const row = await queries.getInProgressSession(state.userId);
    expect(row).toBeNull();
  });

  test("returns the open row when one exists", async () => {
    const projectId = await seedProject();
    const start = await actions.startSession({ projectId });
    if (!start.ok) throw new Error(start.error);

    const row = await queries.getInProgressSession(state.userId);
    expect(row?.id).toBe(start.data.sessionId);
    expect(row?.endedAt).toBeNull();
  });

  test("returns null after the session ends", async () => {
    const projectId = await seedProject();
    const start = await actions.startSession({ projectId });
    if (!start.ok) throw new Error(start.error);
    await actions.endSession({ sessionId: start.data.sessionId });

    const row = await queries.getInProgressSession(state.userId);
    expect(row).toBeNull();
  });
});

describe("rollup helpers — today + week sums", () => {
  test("today rollup sums duration_seconds since local midnight", async () => {
    const projectId = await seedProject();
    // Seed two completed sessions today and one yesterday.
    const todayStart = (() => {
      const d = new Date();
      d.setHours(8, 0, 0, 0);
      return d;
    })();
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      d.setHours(15, 0, 0, 0);
      return d;
    })();

    await state.db!.insert(paintSessions).values([
      {
        id: nanoid(16),
        userId: state.userId,
        projectId,
        startedAt: todayStart,
        endedAt: new Date(todayStart.getTime() + 30 * 60 * 1000),
        durationSeconds: 30 * 60,
        pausedMs: 0,
      },
      {
        id: nanoid(16),
        userId: state.userId,
        projectId,
        startedAt: new Date(todayStart.getTime() + 60 * 60 * 1000),
        endedAt: new Date(todayStart.getTime() + 90 * 60 * 1000),
        durationSeconds: 30 * 60,
        pausedMs: 0,
      },
      {
        id: nanoid(16),
        userId: state.userId,
        projectId,
        startedAt: yesterday,
        endedAt: new Date(yesterday.getTime() + 45 * 60 * 1000),
        durationSeconds: 45 * 60,
        pausedMs: 0,
      },
    ]);

    const today = await queries.getTodayRollupSeconds(state.userId);
    // 30 + 30 minutes = 3600s. Yesterday must not contribute.
    expect(today).toBe(3_600);
  });

  test("week rollup includes sessions from Monday onwards", async () => {
    const projectId = await seedProject();
    // Pin "now" to Wednesday 12pm local. Seed a session on Monday 9am
    // (this week) and one on the prior Sunday (last week).
    const now = (() => {
      const d = new Date();
      // Find this Wednesday. setDate forwards/backwards as needed.
      const dow = d.getDay(); // 0 = Sun .. 6 = Sat
      // Want Wednesday = 3.
      d.setDate(d.getDate() + (3 - dow));
      d.setHours(12, 0, 0, 0);
      return d;
    })();

    const monday = new Date(now);
    monday.setDate(now.getDate() - 2); // Wed - 2 = Mon
    monday.setHours(9, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() - 1); // Sunday before week start

    await state.db!.insert(paintSessions).values([
      {
        id: nanoid(16),
        userId: state.userId,
        projectId,
        startedAt: monday,
        endedAt: new Date(monday.getTime() + 60 * 60 * 1000),
        durationSeconds: 60 * 60,
        pausedMs: 0,
      },
      {
        id: nanoid(16),
        userId: state.userId,
        projectId,
        startedAt: sunday,
        endedAt: new Date(sunday.getTime() + 120 * 60 * 1000),
        durationSeconds: 120 * 60,
        pausedMs: 0,
      },
    ]);

    const week = await queries.getWeekRollupSeconds(state.userId, now.getTime());
    // Only Monday's 60min should count — Sunday is the previous week
    // under the Monday-start convention.
    expect(week).toBe(3_600);
  });

  test("getSessionRollups returns both totals in one call", async () => {
    const rollups = await queries.getSessionRollups(state.userId);
    expect(rollups.todaySeconds).toBe(0);
    expect(rollups.weekSeconds).toBe(0);
  });

  test("in-progress sessions are NOT included in rollups (no duration_seconds yet)", async () => {
    const projectId = await seedProject();
    await actions.startSession({ projectId });
    // The open row has no duration_seconds. Rollup should stay 0.
    const today = await queries.getTodayRollupSeconds(state.userId);
    expect(today).toBe(0);
  });
});

describe("getProjectRollupSecondsMap — per-project lifetime totals (UX-003)", () => {
  test("sums duration_seconds grouped by project id", async () => {
    const projectA = await seedProject("Army A");
    const projectB = await seedProject("Unit B");
    const base = new Date();
    base.setHours(9, 0, 0, 0);

    await state.db!.insert(paintSessions).values([
      {
        id: nanoid(16),
        userId: state.userId,
        projectId: projectA,
        startedAt: base,
        endedAt: new Date(base.getTime() + 30 * 60 * 1000),
        durationSeconds: 30 * 60,
        pausedMs: 0,
      },
      {
        id: nanoid(16),
        userId: state.userId,
        projectId: projectA,
        startedAt: new Date(base.getTime() + 60 * 60 * 1000),
        endedAt: new Date(base.getTime() + 75 * 60 * 1000),
        durationSeconds: 15 * 60,
        pausedMs: 0,
      },
      {
        id: nanoid(16),
        userId: state.userId,
        projectId: projectB,
        startedAt: base,
        endedAt: new Date(base.getTime() + 45 * 60 * 1000),
        durationSeconds: 45 * 60,
        pausedMs: 0,
      },
    ]);

    const map = await queries.getProjectRollupSecondsMap(state.userId);
    expect(map.get(projectA)).toBe(45 * 60);
    expect(map.get(projectB)).toBe(45 * 60);
  });

  test("projects with no logged time are absent from the map", async () => {
    await seedProject("Untouched");
    const map = await queries.getProjectRollupSecondsMap(state.userId);
    expect(map.size).toBe(0);
  });
});
