import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { projects } from "@/db/schema";

/**
 * Per-test DB + auth mocking. Vitest hoists vi.mock() to module init,
 * but the factory closes over the `state` object so we can swap the
 * underlying db + user id in beforeEach without re-declaring the mock.
 */
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

// Import the action AFTER the mocks above are set up.
const { bumpCounter } = await import("@/lib/actions/counters");

async function seedProject(overrides: Partial<typeof projects.$inferInsert> = {}) {
  const id = nanoid(16);
  await state.db!.insert(projects).values({
    id,
    ownerId: state.userId,
    type: "Unit",
    name: "Test Squad",
    count: 20,
    ownedCount: 10,
    buildCount: 8,
    primeCount: 6,
    paintCount: 4,
    baseCount: 2,
    completeCount: 1,
    ...overrides,
  });
  return id;
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

describe("bumpCounter", () => {
  test("advances a valid stage by +1 and revalidates", async () => {
    const projectId = await seedProject();
    const res = await bumpCounter({ projectId, stage: "paint", delta: 1 });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.paintCount).toBe(5);

    const [row] = await state
      .db!.select({ paintCount: projects.paintCount })
      .from(projects)
      .where(eq(projects.id, projectId));
    expect(row?.paintCount).toBe(5);
  });

  test("rejects a bump that would violate the cascade", async () => {
    // paint === prime → cannot increment paint
    const projectId = await seedProject({ paintCount: 6, primeCount: 6 });
    const res = await bumpCounter({ projectId, stage: "paint", delta: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/can't exceed Prime/);
  });

  test("rejects a bump below 0", async () => {
    const projectId = await seedProject({
      ownedCount: 0,
      buildCount: 0,
      primeCount: 0,
      paintCount: 0,
      baseCount: 0,
      completeCount: 0,
    });
    const res = await bumpCounter({ projectId, stage: "complete", delta: -1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/below 0/);
  });

  test("rejects access to a project owned by another user", async () => {
    // Seed a project then point the test user away from it.
    const projectId = await seedProject();
    state.userId = nanoid(16);
    const res = await bumpCounter({ projectId, stage: "paint", delta: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not found/i);
  });

  test("each test starts on a fresh DB (no leakage)", async () => {
    const rows = await state.db!.select().from(projects);
    expect(rows).toHaveLength(0);
  });
});
