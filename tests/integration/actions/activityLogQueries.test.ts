/**
 * P14.4 — Shared activity_log query layer.
 *
 * Pins the two queries the PLANNER widgets read from:
 *
 *   getRecentActivity(userId, limit)
 *     → latest N rows with refId resolved to the entity's display
 *       name (project / recipe / zone / wishlist).
 *   getActivityByDay(userId, sinceTs)
 *     → rows bucketed by UTC date with count + kinds.
 *
 * The queries are the single source of truth for the activity stream
 * (P14.4), streak counter (P14.5), and heatmap (P14.6). Every
 * widget-facing assertion lives here so the widgets themselves can
 * stay thin and visual.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { nanoid } from "nanoid";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import {
  activityLog,
  projects,
  recipes,
  recipeSlots,
  wishlistItems,
} from "@/db/schema";

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

const { getRecentActivity, getActivityByDay, toDayKey } = await import(
  "@/db/queries/activityLog"
);

async function seedProject(name: string): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(projects).values({
    id,
    ownerId: state.userId,
    type: "Unit",
    name,
    count: 5,
  });
  return id;
}

async function seedRecipe(name: string): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(recipes).values({
    id,
    ownerId: state.userId,
    name,
    bodyType: "infantry",
    isStandalone: true,
  });
  return id;
}

async function seedSlot(recipeId: string): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(recipeSlots).values({
    id,
    recipeId,
    position: 0,
    technique: "basecoat",
    customColorHex: "#aabbcc",
  });
  return id;
}

async function seedWishlistItem(
  title: string,
  projectId: string | null = null,
): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(wishlistItems).values({
    id,
    ownerId: state.userId,
    title,
    category: "Paint",
    priority: "Medium",
    status: "WISHLIST",
    kind: "paint",
    projectId,
  });
  return id;
}

async function seedActivity(
  kind:
    | "stage_bump"
    | "recipe_created"
    | "project_created"
    | "paint_added"
    | "slot_added",
  refId: string | null,
  createdAt: Date,
  ownerId?: string,
): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(activityLog).values({
    id,
    userId: ownerId ?? state.userId,
    kind,
    refId,
    createdAt,
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

describe("getRecentActivity (P14.4)", () => {
  test("returns empty array when the painter has no activity yet", async () => {
    const rows = await getRecentActivity(state.userId);
    expect(rows).toEqual([]);
  });

  test("returns rows newest-first, capped by the limit argument", async () => {
    const now = Date.now();
    const projectId = await seedProject("Salamanders");
    for (let i = 0; i < 25; i++) {
      await seedActivity(
        "stage_bump",
        projectId,
        new Date(now - i * 60_000),
      );
    }
    const rows = await getRecentActivity(state.userId, 20);
    expect(rows).toHaveLength(20);
    // Newest first — the first row should be the most recent.
    expect(rows[0]!.createdAt.getTime()).toBeGreaterThan(
      rows[rows.length - 1]!.createdAt.getTime(),
    );
  });

  test("default limit is 20 rows", async () => {
    const projectId = await seedProject("Squad");
    for (let i = 0; i < 30; i++) {
      await seedActivity(
        "stage_bump",
        projectId,
        new Date(Date.now() - i * 1000),
      );
    }
    const rows = await getRecentActivity(state.userId);
    expect(rows).toHaveLength(20);
  });

  test("resolves stage_bump refId to the project name", async () => {
    const projectId = await seedProject("Necron Lychguard");
    await seedActivity("stage_bump", projectId, new Date());
    const rows = await getRecentActivity(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("stage_bump");
    expect(rows[0]!.displayName).toBe("Necron Lychguard");
  });

  test("resolves project_created refId to the project name", async () => {
    const projectId = await seedProject("Salamanders Army");
    await seedActivity("project_created", projectId, new Date());
    const rows = await getRecentActivity(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.displayName).toBe("Salamanders Army");
  });

  test("resolves recipe_created refId to the recipe name", async () => {
    const recipeId = await seedRecipe("Bone White");
    await seedActivity("recipe_created", recipeId, new Date());
    const rows = await getRecentActivity(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.displayName).toBe("Bone White");
  });

  test("resolves slot_added refId to the parent recipe name (flat slots have no name)", async () => {
    const recipeId = await seedRecipe("Test Scheme");
    const slotId = await seedSlot(recipeId);
    await seedActivity("slot_added", slotId, new Date());
    const rows = await getRecentActivity(state.userId);
    expect(rows).toHaveLength(1);
    // Flat slots carry no per-slot name; the row resolves the parent
    // recipe name so the stream reads "Added slot to <recipe>".
    expect(rows[0]!.displayName).toBeNull();
    expect(rows[0]!.parentRecipeName).toBe("Test Scheme");
  });

  test("resolves paint_added → wishlist → project name when wishlist is project-scoped", async () => {
    const projectId = await seedProject("Salamanders");
    const itemId = await seedWishlistItem("Mephiston Red", projectId);
    await seedActivity("paint_added", itemId, new Date());
    const rows = await getRecentActivity(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.displayName).toBe("Salamanders");
  });

  test("paint_added with no project-scope yields null displayName (the widget renders 'Bought paint')", async () => {
    const itemId = await seedWishlistItem("Citadel Paint", null);
    await seedActivity("paint_added", itemId, new Date());
    const rows = await getRecentActivity(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.displayName).toBeNull();
  });

  test("rows are scoped to the calling user — other users' rows are invisible", async () => {
    const other = await seedExtraUser(state.db!);
    const myProjectId = await seedProject("Mine");
    await seedActivity("stage_bump", myProjectId, new Date());

    // Other user's row — pre-create their project so the FK holds.
    const otherProjectId = nanoid(16);
    await state.db!.insert(projects).values({
      id: otherProjectId,
      ownerId: other,
      type: "Unit",
      name: "Theirs",
      count: 1,
    });
    await seedActivity("stage_bump", otherProjectId, new Date(), other);

    const rows = await getRecentActivity(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.displayName).toBe("Mine");
  });

  test("survives stale refIds (project deleted after the activity row was written)", async () => {
    // Seed an activity row with a refId that never resolves.
    await seedActivity(
      "stage_bump",
      "non-existent-project-id",
      new Date(),
    );
    const rows = await getRecentActivity(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.displayName).toBeNull();
    expect(rows[0]!.kind).toBe("stage_bump");
  });

  test("mixed kinds resolve correctly in a single round-trip", async () => {
    const now = Date.now();
    const projectId = await seedProject("Salamanders");
    const recipeId = await seedRecipe("Crimson Fists");
    const slotId = await seedSlot(recipeId);
    const itemId = await seedWishlistItem("Boltgun Metal", projectId);

    await seedActivity("project_created", projectId, new Date(now - 5_000));
    await seedActivity("recipe_created", recipeId, new Date(now - 4_000));
    await seedActivity("slot_added", slotId, new Date(now - 3_000));
    await seedActivity("paint_added", itemId, new Date(now - 2_000));
    await seedActivity("stage_bump", projectId, new Date(now - 1_000));

    const rows = await getRecentActivity(state.userId);
    expect(rows).toHaveLength(5);
    // Newest first.
    expect(rows[0]!.kind).toBe("stage_bump");
    expect(rows[0]!.displayName).toBe("Salamanders");
    expect(rows[1]!.kind).toBe("paint_added");
    expect(rows[1]!.displayName).toBe("Salamanders");
    expect(rows[2]!.kind).toBe("slot_added");
    expect(rows[2]!.displayName).toBeNull();
    expect(rows[2]!.parentRecipeName).toBe("Crimson Fists");
    expect(rows[3]!.kind).toBe("recipe_created");
    expect(rows[3]!.displayName).toBe("Crimson Fists");
    expect(rows[4]!.kind).toBe("project_created");
    expect(rows[4]!.displayName).toBe("Salamanders");
  });
});

describe("getActivityByDay (P14.4 shared layer for P14.5 + P14.6)", () => {
  test("returns empty array when the painter has no activity yet", async () => {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const days = await getActivityByDay(state.userId, since);
    expect(days).toEqual([]);
  });

  test("buckets rows by UTC date — multiple rows on one day collapse to one entry", async () => {
    const projectId = await seedProject("Salamanders");
    // 09:00, 13:00, 22:00 — all the same UTC date.
    const day = new Date("2026-05-26T00:00:00.000Z");
    for (const hh of [9, 13, 22]) {
      const d = new Date(day);
      d.setUTCHours(hh, 0, 0, 0);
      await seedActivity("stage_bump", projectId, d);
    }
    const since = new Date(day.getTime() - 24 * 60 * 60 * 1000);
    const days = await getActivityByDay(state.userId, since);
    expect(days).toHaveLength(1);
    expect(days[0]!.date).toBe("2026-05-26");
    expect(days[0]!.count).toBe(3);
  });

  test("returns days newest-first", async () => {
    const projectId = await seedProject("Salamanders");
    for (const iso of ["2026-05-20", "2026-05-22", "2026-05-21"]) {
      await seedActivity(
        "stage_bump",
        projectId,
        new Date(`${iso}T12:00:00.000Z`),
      );
    }
    const since = new Date("2026-05-01T00:00:00.000Z");
    const days = await getActivityByDay(state.userId, since);
    expect(days.map((d) => d.date)).toEqual([
      "2026-05-22",
      "2026-05-21",
      "2026-05-20",
    ]);
  });

  test("collects the distinct kinds on each day", async () => {
    const projectId = await seedProject("Salamanders");
    const recipeId = await seedRecipe("Bone");
    const day = new Date("2026-05-26T12:00:00.000Z");
    await seedActivity("stage_bump", projectId, day);
    await seedActivity("stage_bump", projectId, day);
    await seedActivity("recipe_created", recipeId, day);
    const days = await getActivityByDay(
      state.userId,
      new Date("2026-05-01T00:00:00.000Z"),
    );
    expect(days).toHaveLength(1);
    expect(days[0]!.count).toBe(3);
    expect([...days[0]!.kinds].sort()).toEqual([
      "recipe_created",
      "stage_bump",
    ]);
  });

  test("respects the sinceTs window — rows older than sinceTs are excluded", async () => {
    const projectId = await seedProject("Salamanders");
    await seedActivity(
      "stage_bump",
      projectId,
      new Date("2026-01-01T12:00:00.000Z"),
    );
    await seedActivity(
      "stage_bump",
      projectId,
      new Date("2026-05-26T12:00:00.000Z"),
    );
    const days = await getActivityByDay(
      state.userId,
      new Date("2026-05-01T00:00:00.000Z"),
    );
    expect(days).toHaveLength(1);
    expect(days[0]!.date).toBe("2026-05-26");
  });

  test("rows are scoped to the calling user", async () => {
    const other = await seedExtraUser(state.db!);
    const projectId = await seedProject("Salamanders");
    await seedActivity("stage_bump", projectId, new Date());

    // Other user's project + activity row.
    const theirProjectId = nanoid(16);
    await state.db!.insert(projects).values({
      id: theirProjectId,
      ownerId: other,
      type: "Unit",
      name: "Theirs",
      count: 1,
    });
    await seedActivity(
      "stage_bump",
      theirProjectId,
      new Date(),
      other,
    );

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const mine = await getActivityByDay(state.userId, since);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.count).toBe(1);
  });
});

describe("toDayKey (UTC day key projection)", () => {
  test("formats as YYYY-MM-DD with zero-padding", () => {
    expect(toDayKey(new Date("2026-01-05T03:00:00.000Z"))).toBe("2026-01-05");
    expect(toDayKey(new Date("2026-12-31T23:59:59.999Z"))).toBe("2026-12-31");
  });

  test("projects to the UTC date, not the local date", () => {
    // A timestamp two hours past UTC midnight projects to that UTC day
    // regardless of the runner's local TZ.
    expect(toDayKey(new Date("2026-05-26T02:00:00.000Z"))).toBe("2026-05-26");
  });
});
