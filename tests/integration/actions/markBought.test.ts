import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { projects, wishlistItems } from "@/db/schema";

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

const { markBoughtAsNewProject, markBoughtAsExistingUnit } = await import(
  "@/lib/actions/markBought"
);

async function seedWishlistItem(ownerId = state.userId): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(wishlistItems).values({
    id,
    ownerId,
    title: "Necron Warriors",
    status: "WISHLIST",
  });
  return id;
}

async function seedProject(
  patch: Partial<typeof projects.$inferInsert> = {},
): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(projects).values({
    id,
    ownerId: state.userId,
    type: "Unit",
    name: "Existing Squad",
    count: 20,
    ...patch,
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

describe("markBoughtAsNewProject", () => {
  test("creates a project and stamps the wishlist row Bought", async () => {
    const wishlistItemId = await seedWishlistItem();
    const res = await markBoughtAsNewProject({
      wishlistItemId,
      name: "Necron Warriors",
      type: "Unit",
      count: 20,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const [project] = await state.db!
      .select()
      .from(projects)
      .where(eq(projects.id, res.data.projectId));
    expect(project!.name).toBe("Necron Warriors");
    expect(project!.count).toBe(20);

    const [item] = await state.db!
      .select()
      .from(wishlistItems)
      .where(eq(wishlistItems.id, wishlistItemId));
    expect(item!.status).toBe("PURCHASED");
    expect(item!.dateResolved).not.toBeNull();
  });

  test("preserves the caller's count for a Unit (P13.4 — Single Model gone)", async () => {
    const wishlistItemId = await seedWishlistItem();
    const res = await markBoughtAsNewProject({
      wishlistItemId,
      name: "Captain",
      type: "Unit",
      count: 1,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const [project] = await state.db!
      .select()
      .from(projects)
      .where(eq(projects.id, res.data.projectId));
    expect(project!.count).toBe(1);
  });

  test("nests under a valid Army parent", async () => {
    const wishlistItemId = await seedWishlistItem();
    const armyId = await seedProject({ type: "Army", name: "My Necrons" });
    const res = await markBoughtAsNewProject({
      wishlistItemId,
      name: "Warriors",
      type: "Unit",
      count: 10,
      parentId: armyId,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [project] = await state.db!
      .select()
      .from(projects)
      .where(eq(projects.id, res.data.projectId));
    expect(project!.parentId).toBe(armyId);
  });

  test("P13.4 — Unit parent is allowed (Army/Warband/Unit can host sub-Units)", async () => {
    const wishlistItemId = await seedWishlistItem();
    const unitId = await seedProject({ type: "Unit" });
    const res = await markBoughtAsNewProject({
      wishlistItemId,
      name: "Warriors",
      type: "Unit",
      count: 10,
      parentId: unitId,
    });
    expect(res.ok).toBe(true);
  });

  test("P13.4 — non-Unit sub-project type is rejected", async () => {
    const wishlistItemId = await seedWishlistItem();
    const armyId = await seedProject({ type: "Army", name: "My Army" });
    const res = await markBoughtAsNewProject({
      wishlistItemId,
      name: "Bad child",
      type: "Terrain Piece",
      count: 1,
      parentId: armyId,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Sub-projects must be of type Unit/);
  });

  test("rejects nesting beyond 3 levels", async () => {
    const wishlistItemId = await seedWishlistItem();
    const armyId = await seedProject({ type: "Army", name: "Army" });
    const unitId = await seedProject({
      type: "Unit",
      name: "Unit",
      parentId: armyId,
    });
    const res = await markBoughtAsNewProject({
      wishlistItemId,
      name: "Grandchild",
      type: "Unit",
      count: 1,
      parentId: unitId,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Maximum 3 levels/);
  });

  test("rejects an unknown wishlist item", async () => {
    const res = await markBoughtAsNewProject({
      wishlistItemId: "no-such-item",
      name: "Ghost",
      type: "Unit",
      count: 5,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Wishlist item not found/);
  });

  test("does not stamp Bought when validation fails", async () => {
    const wishlistItemId = await seedWishlistItem();
    const res = await markBoughtAsNewProject({
      wishlistItemId,
      name: "  ",
      type: "Unit",
      count: 5,
    });
    expect(res.ok).toBe(false);
    const [item] = await state.db!
      .select()
      .from(wishlistItems)
      .where(eq(wishlistItems.id, wishlistItemId));
    expect(item!.status).toBe("WISHLIST");
  });

  test("cannot resolve another user's wishlist item", async () => {
    const otherUserId = await seedExtraUser(state.db!);
    const foreignItem = await seedWishlistItem(otherUserId);
    const res = await markBoughtAsNewProject({
      wishlistItemId: foreignItem,
      name: "Stolen",
      type: "Unit",
      count: 5,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Wishlist item not found/);
  });
});

describe("markBoughtAsExistingUnit", () => {
  test("bumps owned_count by the delta and stamps Bought", async () => {
    const wishlistItemId = await seedWishlistItem();
    const projectId = await seedProject({ count: 20, ownedCount: 0 });
    const res = await markBoughtAsExistingUnit({
      wishlistItemId,
      projectId,
      delta: 10,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.ownedCount).toBe(10);

    const [project] = await state.db!
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    expect(project!.ownedCount).toBe(10);

    const [item] = await state.db!
      .select()
      .from(wishlistItems)
      .where(eq(wishlistItems.id, wishlistItemId));
    expect(item!.status).toBe("PURCHASED");
  });

  test("rejects a delta that would exceed the roster cap", async () => {
    const wishlistItemId = await seedWishlistItem();
    const projectId = await seedProject({ count: 5, ownedCount: 3 });
    const res = await markBoughtAsExistingUnit({
      wishlistItemId,
      projectId,
      delta: 5,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/roster cap/);

    const [project] = await state.db!
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    expect(project!.ownedCount).toBe(3);
    const [item] = await state.db!
      .select()
      .from(wishlistItems)
      .where(eq(wishlistItems.id, wishlistItemId));
    expect(item!.status).toBe("WISHLIST");
  });

  test("rejects an unknown target project", async () => {
    const wishlistItemId = await seedWishlistItem();
    const res = await markBoughtAsExistingUnit({
      wishlistItemId,
      projectId: "no-such-project",
      delta: 1,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Target project not found/);
  });

  test("cannot target another user's project", async () => {
    const wishlistItemId = await seedWishlistItem();
    const otherUserId = await seedExtraUser(state.db!);
    const foreignProject = nanoid(16);
    await state.db!.insert(projects).values({
      id: foreignProject,
      ownerId: otherUserId,
      type: "Unit",
      name: "Not mine",
      count: 20,
    });
    const res = await markBoughtAsExistingUnit({
      wishlistItemId,
      projectId: foreignProject,
      delta: 1,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Target project not found/);
  });
});
