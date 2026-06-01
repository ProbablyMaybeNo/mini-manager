import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { projects } from "@/db/schema";

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
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const {
  createProject,
  updateProjectType,
  updateProjectPriority,
  bumpProjectStatus,
  deleteProject,
  countProjectDescendants,
} = await import("@/lib/actions/projects");
const { redirect } = await import("next/navigation");
const { displayStatus } = await import("@/lib/progress");

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
  vi.mocked(redirect).mockClear();
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("createProject", () => {
  test("inserts a row and redirects to the new workspace", async () => {
    await createProject({ name: "Test Unit", type: "Unit", count: 10 });

    const rows = await state.db!.select().from(projects);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Test Unit");
    expect(rows[0]!.count).toBe(10);
    expect(rows[0]!.ownerId).toBe(state.userId);
    expect(vi.mocked(redirect)).toHaveBeenCalledWith(`/projects/${rows[0]!.id}`);
  });

  test("rejects empty name", async () => {
    const res = await createProject({ name: "  ", type: "Unit", count: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Name is required/);
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });

  test("rejects negative count", async () => {
    const res = await createProject({ name: "Foo", type: "Unit", count: -3 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Count cannot be negative/);
  });

  test("happy path nesting: Unit inside an Army", async () => {
    await createProject({ name: "My Army", type: "Army", count: 0 });
    const [army] = await state.db!.select().from(projects);

    await createProject({
      name: "Tactical Squad",
      type: "Unit",
      count: 10,
      parentId: army!.id,
    });

    const child = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.name, "Tactical Squad"));
    expect(child[0]!.parentId).toBe(army!.id);
  });

  test("P13.4 — Unit is now a legal parent (Army/Warband/Unit can host sub-Units)", async () => {
    await createProject({ name: "Top Unit", type: "Unit", count: 10 });
    const [unit] = await state.db!.select().from(projects);

    await createProject({
      name: "Sub-unit",
      type: "Unit",
      count: 5,
      parentId: unit!.id,
    });
    const child = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.name, "Sub-unit"));
    expect(child).toHaveLength(1);
    expect(child[0]!.parentId).toBe(unit!.id);
  });

  test("P13.4 — sub-projects must be Unit type (Terrain rejected)", async () => {
    await createProject({ name: "An Army", type: "Army", count: 0 });
    const [army] = await state.db!.select().from(projects);

    const res = await createProject({
      name: "Bad child",
      type: "Terrain Piece",
      count: 1,
      parentId: army!.id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Sub-projects must be of type Unit/);
  });

  test("P13.4 — parent that isn't Army/Warband/Unit is rejected (e.g. Terrain Piece can't parent)", async () => {
    await createProject({
      name: "Top terrain",
      type: "Terrain Piece",
      count: 1,
    });
    const [terrain] = await state.db!.select().from(projects);

    const res = await createProject({
      name: "Sub",
      type: "Unit",
      count: 1,
      parentId: terrain!.id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Only Army, Warband, or Unit parents/);
  });

  test("rejects 3-deep nesting (Army → Unit → Unit grandchild blocked)", async () => {
    await createProject({ name: "Army", type: "Army", count: 0 });
    const [army] = await state.db!.select().from(projects);
    await createProject({
      name: "Mid Unit",
      type: "Unit",
      count: 0,
      parentId: army!.id,
    });
    const [mid] = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.parentId, army!.id));

    const res = await createProject({
      name: "Grandchild",
      type: "Unit",
      count: 5,
      parentId: mid!.id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Maximum 3 levels/);
  });

  test("rejects parent owned by a different user", async () => {
    await createProject({ name: "Army", type: "Army", count: 0 });
    const [army] = await state.db!.select().from(projects);

    state.userId = "different-user";
    const res = await createProject({
      name: "Unit",
      type: "Unit",
      count: 5,
      parentId: army!.id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Parent project not found/);
  });
});

/* ============================================================
   R7-1 — inline dashboard editing actions
   ============================================================ */

describe("updateProjectType", () => {
  test("changes the type for the owner", async () => {
    await createProject({ name: "Squad", type: "Unit", count: 10 });
    const [row] = await state.db!.select().from(projects);

    const res = await updateProjectType({ id: row!.id, type: "Terrain Piece" });
    expect(res.ok).toBe(true);

    const [updated] = await state.db!.select().from(projects);
    expect(updated!.type).toBe("Terrain Piece");
  });

  test("does not touch projects owned by another user", async () => {
    await createProject({ name: "Squad", type: "Unit", count: 10 });
    const [row] = await state.db!.select().from(projects);

    state.userId = "other-user";
    const res = await updateProjectType({ id: row!.id, type: "Army" });
    expect(res.ok).toBe(false);
  });
});

describe("updateProjectPriority", () => {
  test("sets a priority + clears it via null", async () => {
    await createProject({ name: "Squad", type: "Unit", count: 5 });
    const [row] = await state.db!.select().from(projects);

    const setRes = await updateProjectPriority({
      id: row!.id,
      priority: "Urgent",
    });
    expect(setRes.ok).toBe(true);
    const [afterSet] = await state.db!.select().from(projects);
    expect(afterSet!.priority).toBe("Urgent");

    const clearRes = await updateProjectPriority({
      id: row!.id,
      priority: null,
    });
    expect(clearRes.ok).toBe(true);
    const [afterClear] = await state.db!.select().from(projects);
    expect(afterClear!.priority).toBeNull();
  });
});

describe("bumpProjectStatus", () => {
  test("PURCHASED — sets owned ≥ 1, zeroes the rest", async () => {
    await createProject({ name: "Squad", type: "Unit", count: 10 });
    const [row] = await state.db!.select().from(projects);

    const res = await bumpProjectStatus({ id: row!.id, status: "PURCHASED" });
    expect(res.ok).toBe(true);

    const [updated] = await state.db!.select().from(projects);
    expect(displayStatus(updated!)).toBe("PURCHASED");
    expect(updated!.ownedCount).toBeGreaterThanOrEqual(1);
    expect(updated!.buildCount).toBe(0);
  });

  test("PAINTING — cascade lifts owned/build/prime/paint to ≥ 1", async () => {
    await createProject({ name: "Squad", type: "Unit", count: 5 });
    const [row] = await state.db!.select().from(projects);

    const res = await bumpProjectStatus({ id: row!.id, status: "PAINTING" });
    expect(res.ok).toBe(true);

    const [updated] = await state.db!.select().from(projects);
    expect(displayStatus(updated!)).toBe("PAINTING");
    expect(updated!.ownedCount).toBeGreaterThanOrEqual(1);
    expect(updated!.buildCount).toBeGreaterThanOrEqual(1);
    expect(updated!.primeCount).toBeGreaterThanOrEqual(1);
    expect(updated!.paintCount).toBeGreaterThanOrEqual(1);
    expect(updated!.baseCount).toBe(0);
    expect(updated!.completeCount).toBe(0);
  });

  test("WISHLIST — zeroes count + all stages", async () => {
    await createProject({ name: "Squad", type: "Unit", count: 8 });
    const [row] = await state.db!.select().from(projects);
    await bumpProjectStatus({ id: row!.id, status: "PAINTING" });

    const res = await bumpProjectStatus({ id: row!.id, status: "WISHLIST" });
    expect(res.ok).toBe(true);

    const [updated] = await state.db!.select().from(projects);
    expect(displayStatus(updated!)).toBe("WISHLIST");
    expect(updated!.count).toBe(0);
    expect(updated!.ownedCount).toBe(0);
    expect(updated!.buildCount).toBe(0);
  });

  test("SHELVED — sets isShelved without disturbing counters", async () => {
    await createProject({ name: "Squad", type: "Unit", count: 5 });
    const [row] = await state.db!.select().from(projects);
    await bumpProjectStatus({ id: row!.id, status: "PAINTING" });
    const [beforeShelve] = await state.db!.select().from(projects);

    const res = await bumpProjectStatus({ id: row!.id, status: "SHELVED" });
    expect(res.ok).toBe(true);

    const [updated] = await state.db!.select().from(projects);
    expect(displayStatus(updated!)).toBe("SHELVED");
    expect(updated!.isShelved).toBe(true);
    // Stage counters unchanged
    expect(updated!.paintCount).toBe(beforeShelve!.paintCount);
  });

  test("demote: COMPLETE → PAINTING clears base + complete", async () => {
    await createProject({ name: "Squad", type: "Unit", count: 4 });
    const [row] = await state.db!.select().from(projects);
    await bumpProjectStatus({ id: row!.id, status: "COMPLETE" });

    const res = await bumpProjectStatus({ id: row!.id, status: "PAINTING" });
    expect(res.ok).toBe(true);

    const [updated] = await state.db!.select().from(projects);
    expect(displayStatus(updated!)).toBe("PAINTING");
    expect(updated!.baseCount).toBe(0);
    expect(updated!.completeCount).toBe(0);
    expect(updated!.paintCount).toBeGreaterThanOrEqual(1);
  });

  test("COMPLETE — fills every lane to count", async () => {
    await createProject({ name: "Squad", type: "Unit", count: 6 });
    const [row] = await state.db!.select().from(projects);

    const res = await bumpProjectStatus({ id: row!.id, status: "COMPLETE" });
    expect(res.ok).toBe(true);

    const [updated] = await state.db!.select().from(projects);
    expect(displayStatus(updated!)).toBe("COMPLETE");
    expect(updated!.completeCount).toBe(updated!.count);
  });
});

/* ============================================================
   P13.3 — deleteProject + cascade
   ============================================================ */

describe("countProjectDescendants", () => {
  test("returns 0 for a leaf project with no children", async () => {
    await createProject({ name: "Lone Unit", type: "Unit", count: 5 });
    const [row] = await state.db!.select().from(projects);
    const res = await countProjectDescendants({ id: row!.id });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.count).toBe(0);
  });

  test("walks the full sub-tree (Army → Unit → Unit)", async () => {
    await createProject({ name: "Army", type: "Army", count: 0 });
    const [army] = await state.db!.select().from(projects);
    await createProject({
      name: "Mid Unit",
      type: "Unit",
      count: 0,
      parentId: army!.id,
    });
    const [mid] = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.parentId, army!.id));
    // Try to nest grandchild — blocked by 3-level cap. Insert a second
    // top-level child instead so we exercise multiple descendants.
    await createProject({
      name: "Sibling Unit",
      type: "Unit",
      count: 0,
      parentId: army!.id,
    });

    const res = await countProjectDescendants({ id: army!.id });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.count).toBe(2);
    // Mid-level project's own descendant count is 0 (3-level cap).
    const midRes = await countProjectDescendants({ id: mid!.id });
    if (midRes.ok) expect(midRes.data.count).toBe(0);
  });

  test("rejects a project the user doesn't own", async () => {
    await createProject({ name: "Mine", type: "Unit", count: 5 });
    const [row] = await state.db!.select().from(projects);
    state.userId = "intruder";
    const res = await countProjectDescendants({ id: row!.id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Project not found/);
  });
});

describe("deleteProject", () => {
  test("removes a leaf project", async () => {
    await createProject({ name: "Doomed", type: "Unit", count: 5 });
    const [row] = await state.db!.select().from(projects);

    const res = await deleteProject({ id: row!.id });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.descendantCount).toBe(0);

    const after = await state.db!.select().from(projects);
    expect(after).toHaveLength(0);
  });

  test("cascade-removes every descendant in one shot", async () => {
    await createProject({ name: "Army", type: "Army", count: 0 });
    const [army] = await state.db!.select().from(projects);
    await createProject({
      name: "Unit A",
      type: "Unit",
      count: 10,
      parentId: army!.id,
    });
    await createProject({
      name: "Unit B",
      type: "Unit",
      count: 5,
      parentId: army!.id,
    });

    const before = await state.db!.select().from(projects);
    expect(before).toHaveLength(3);

    const res = await deleteProject({ id: army!.id });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.descendantCount).toBe(2);

    const after = await state.db!.select().from(projects);
    expect(after).toHaveLength(0);
  });

  test("rejects deletion by a different user", async () => {
    await createProject({ name: "Mine", type: "Unit", count: 5 });
    const [row] = await state.db!.select().from(projects);

    state.userId = "intruder";
    const res = await deleteProject({ id: row!.id });
    expect(res.ok).toBe(false);

    const after = await state.db!.select().from(projects);
    expect(after).toHaveLength(1);
  });

  test("does not touch siblings outside the sub-tree", async () => {
    await createProject({ name: "Army A", type: "Army", count: 0 });
    const [armyA] = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.name, "Army A"));
    await createProject({
      name: "Unit under A",
      type: "Unit",
      count: 5,
      parentId: armyA!.id,
    });
    await createProject({ name: "Army B", type: "Army", count: 0 });
    await createProject({ name: "Standalone Unit", type: "Unit", count: 3 });

    const res = await deleteProject({ id: armyA!.id });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.descendantCount).toBe(1);

    const after = await state.db!.select().from(projects);
    // Army B + the standalone unit survive — 2 rows.
    expect(after).toHaveLength(2);
    const names = after.map((r) => r.name).sort();
    expect(names).toEqual(["Army B", "Standalone Unit"]);
  });
});
