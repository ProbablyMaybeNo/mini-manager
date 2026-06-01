import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import {
  activityLog,
  projects,
  recipes,
  recipeZones,
  wishlistItems,
} from "@/db/schema";

/**
 * P14.1 — pin every server action wired to logActivity emits its row.
 *
 * The PLANNER activity stream / streak counter / heatmap all read off
 * `activity_log`. If a wire goes silently missing, those widgets stop
 * updating — a class of bug that's invisible without a test. This file
 * is the single anchor that asserts the emit happens.
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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// createProject calls redirect() on success; swallow so we can assert.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`__REDIRECT__:${url}`);
  },
}));

const { createProject, bumpProjectStatus } = await import(
  "@/lib/actions/projects"
);
const { bumpCounter } = await import("@/lib/actions/counters");
const { createRecipe } = await import("@/lib/actions/recipes");
const { addZone, addSlotWithPaint } = await import(
  "@/lib/actions/recipeZones"
);
const { markBoughtAsExistingUnit, markBoughtAsNewProject } = await import(
  "@/lib/actions/markBought"
);

async function seedProject(
  overrides: Partial<typeof projects.$inferInsert> = {},
): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(projects).values({
    id,
    ownerId: state.userId,
    type: "Unit",
    name: "Test Squad",
    count: 10,
    ownedCount: 5,
    buildCount: 4,
    primeCount: 3,
    paintCount: 2,
    baseCount: 1,
    completeCount: 0,
    ...overrides,
  });
  return id;
}

async function seedRecipe(): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(recipes).values({
    id,
    ownerId: state.userId,
    name: "Test Recipe",
    bodyType: "infantry",
    isStandalone: true,
  });
  return id;
}

async function seedWishlistItem(): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(wishlistItems).values({
    id,
    ownerId: state.userId,
    title: "Citadel Box",
    category: "Box",
    priority: "Medium",
    status: "WISHLIST",
    kind: "model",
  });
  return id;
}

async function fetchLatestActivity(userId: string) {
  const rows = await state
    .db!.select()
    .from(activityLog)
    .where(eq(activityLog.userId, userId))
    .orderBy(desc(activityLog.createdAt));
  return rows;
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

describe("activity_log emit wiring (P14.1)", () => {
  test("createProject emits 'project_created' with the new project id", async () => {
    try {
      await createProject({
        name: "Salamanders Force",
        type: "Army",
        count: 30,
      });
    } catch (err) {
      // createProject redirects on success — swallow our test stub.
      if (!(err instanceof Error) || !err.message.startsWith("__REDIRECT__:")) {
        throw err;
      }
    }
    const rows = await fetchLatestActivity(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("project_created");
    expect(rows[0]!.refId).toBeTruthy();
  });

  test("bumpCounter emits 'stage_bump' with the project id", async () => {
    const projectId = await seedProject();
    const res = await bumpCounter({ projectId, stage: "paint", delta: 1 });
    expect(res.ok).toBe(true);

    const rows = await fetchLatestActivity(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("stage_bump");
    expect(rows[0]!.refId).toBe(projectId);
  });

  test("bumpProjectStatus emits 'stage_bump' for every success branch", async () => {
    // SHELVED branch
    const p1 = await seedProject();
    let res = await bumpProjectStatus({ id: p1, status: "SHELVED" });
    expect(res.ok).toBe(true);

    // WISHLIST branch (zeros everything)
    const p2 = await seedProject();
    res = await bumpProjectStatus({ id: p2, status: "WISHLIST" });
    expect(res.ok).toBe(true);

    // Cascade branch (BUILDING)
    const p3 = await seedProject();
    res = await bumpProjectStatus({ id: p3, status: "BUILDING" });
    expect(res.ok).toBe(true);

    const rows = await fetchLatestActivity(state.userId);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.kind).toBe("stage_bump");
    }
    const refIds = rows.map((r) => r.refId).sort();
    expect(refIds).toEqual([p1, p2, p3].sort());
  });

  test("createRecipe emits 'recipe_created' with the recipe id", async () => {
    const res = await createRecipe({ name: "Necron Bone", bodyType: "infantry" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const rows = await fetchLatestActivity(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("recipe_created");
    expect(rows[0]!.refId).toBe(res.data.id);
  });

  test("addZone emits 'slot_added' with the new zone id", async () => {
    const recipeId = await seedRecipe();
    const res = await addZone({ recipeId, name: "Armor" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const rows = await fetchLatestActivity(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("slot_added");
    expect(rows[0]!.refId).toBe(res.data.id);
  });

  test("addSlotWithPaint emits 'slot_added' with the new zone id", async () => {
    const recipeId = await seedRecipe();
    const res = await addSlotWithPaint({
      recipeId,
      customColorHex: "#abcdef",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const rows = await fetchLatestActivity(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("slot_added");
    expect(rows[0]!.refId).toBe(res.data.zoneId);

    // Sanity: the zone we just created actually exists in the DB
    const zoneRows = await state
      .db!.select()
      .from(recipeZones)
      .where(eq(recipeZones.id, res.data.zoneId));
    expect(zoneRows).toHaveLength(1);
  });

  test("markBoughtAsNewProject emits 'paint_added' with the wishlist item id", async () => {
    const itemId = await seedWishlistItem();
    const res = await markBoughtAsNewProject({
      wishlistItemId: itemId,
      name: "Bought Squad",
      type: "Unit",
      count: 5,
    });
    expect(res.ok).toBe(true);

    const rows = await fetchLatestActivity(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("paint_added");
    expect(rows[0]!.refId).toBe(itemId);
  });

  test("markBoughtAsExistingUnit emits 'paint_added' (+stage_bump for each owned bump)", async () => {
    const projectId = await seedProject({
      ownedCount: 0,
      buildCount: 0,
      primeCount: 0,
      paintCount: 0,
      baseCount: 0,
      completeCount: 0,
    });
    const itemId = await seedWishlistItem();
    const res = await markBoughtAsExistingUnit({
      wishlistItemId: itemId,
      projectId,
      delta: 2,
    });
    expect(res.ok).toBe(true);

    const rows = await fetchLatestActivity(state.userId);
    // Two bumpCounter calls (each emits stage_bump) + one paint_added.
    const kinds = rows.map((r) => r.kind).sort();
    expect(kinds).toEqual(["paint_added", "stage_bump", "stage_bump"]);

    const paintRow = rows.find((r) => r.kind === "paint_added");
    expect(paintRow?.refId).toBe(itemId);
  });

  test("emits are scoped to the calling user", async () => {
    // Bump as user A, then check user B's stream is empty.
    const projectId = await seedProject();
    const userA = state.userId;
    await bumpCounter({ projectId, stage: "paint", delta: 1 });

    const rowsA = await fetchLatestActivity(userA);
    expect(rowsA).toHaveLength(1);

    // Sanity: query under a different user id returns no rows.
    const rowsForGhost = await state
      .db!.select()
      .from(activityLog)
      .where(eq(activityLog.userId, "ghost-user"));
    expect(rowsForGhost).toHaveLength(0);
  });
});
