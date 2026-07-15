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
  setModelClass,
  setProjectComplete,
} = await import("@/lib/actions/projects");
const { redirect } = await import("next/navigation");
const { revalidatePath } = await import("next/cache");
const { displayStatus } = await import("@/lib/progress");

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
  vi.mocked(redirect).mockClear();
  vi.mocked(revalidatePath).mockClear();
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("revalidation target (P3)", () => {
  test("a project mutation revalidates /dashboard, never the /projects redirect", async () => {
    const created = await createProject({ name: "Reval", type: "Unit", count: 1 });
    if (!created.ok) throw new Error("setup failed");
    vi.mocked(revalidatePath).mockClear();

    await updateProjectPriority({ id: created.data.id, priority: "High" });

    const paths = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
    expect(paths).toContain("/dashboard");
    expect(paths).not.toContain("/projects");
  });
});

describe("createProject", () => {
  test("inserts a row and returns the new id", async () => {
    const res = await createProject({ name: "Test Unit", type: "Unit", count: 10 });

    const rows = await state.db!.select().from(projects);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Test Unit");
    expect(rows[0]!.count).toBe(10);
    expect(rows[0]!.ownerId).toBe(state.userId);
    // REBUILD — createProject returns the new id (the redesign drives
    // navigation client-side) instead of redirecting.
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.id).toBe(rows[0]!.id);
  });

  test("Item 2 — persists faction + game when supplied", async () => {
    await createProject({
      name: "Salamanders 2k",
      type: "Army",
      count: 0,
      faction: "Salamanders",
      game: "Warhammer 40,000",
    });

    const rows = await state.db!.select().from(projects);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.faction).toBe("Salamanders");
    expect(rows[0]!.game).toBe("Warhammer 40,000");
  });

  test("Item 2 — blank/omitted faction + game collapse to null", async () => {
    await createProject({
      name: "Bare Army",
      type: "Army",
      count: 0,
      faction: "   ",
      // game omitted entirely
    });

    const rows = await state.db!.select().from(projects);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.faction).toBeNull();
    expect(rows[0]!.game).toBeNull();
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

  test("2026-06-23 — a Unit can't contain another Unit (Units host Models only)", async () => {
    // Containment rules (Ross 2026-06-23): a Unit hosts Models only. A sub-Unit
    // is rejected — a Unit is assigned to an army/warband, not nested in a unit.
    await createProject({ name: "Top Unit", type: "Unit", count: 10 });
    const [unit] = await state.db!.select().from(projects);

    const res = await createProject({
      name: "Sub-unit",
      type: "Unit",
      count: 5,
      parentId: unit!.id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/A Unit can contain: Model/);

    const child = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.name, "Sub-unit"));
    expect(child).toHaveLength(0);
  });

  test("2026-06-05 — a Unit CAN host a Model (model assigned to a unit)", async () => {
    await createProject({ name: "Squad", type: "Unit", count: 10 });
    const [unit] = await state.db!.select().from(projects);

    await createProject({
      name: "Sergeant",
      type: "Model",
      count: 1,
      parentId: unit!.id,
    });
    const child = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.name, "Sergeant"));
    expect(child).toHaveLength(1);
    expect(child[0]!.type).toBe("Model");
    expect(child[0]!.parentId).toBe(unit!.id);
  });

  test("2026-06-05 — a Model never hosts a sub-project (Model parent rejected)", async () => {
    await createProject({ name: "Lone Hero", type: "Model", count: 1 });
    const [model] = await state.db!.select().from(projects);

    const res = await createProject({
      name: "Bad child",
      type: "Unit",
      count: 1,
      parentId: model!.id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok)
      expect(res.error).toMatch(/A Model can't contain sub-projects/);
  });

  test("2026-06-23 — an Army CAN host a Terrain Piece; a Unit cannot", async () => {
    await createProject({ name: "An Army", type: "Army", count: 0 });
    const [army] = await state.db!.select().from(projects);

    // New containment rules (Ross 2026-06-23): an Army hosts Units, Warbands,
    // Models AND Terrain — so Terrain under an Army is a legal sub-project.
    await createProject({
      name: "Objective Ruins",
      type: "Terrain Piece",
      count: 1,
      parentId: army!.id,
    });
    const terrainChild = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.name, "Objective Ruins"));
    expect(terrainChild).toHaveLength(1);
    expect(terrainChild[0]!.type).toBe("Terrain Piece");
    expect(terrainChild[0]!.parentId).toBe(army!.id);

    // …but a Unit hosts Models only, so Terrain under a Unit is rejected.
    await createProject({ name: "Squad", type: "Unit", count: 5 });
    const [unit] = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.name, "Squad"));
    const res = await createProject({
      name: "Bad terrain",
      type: "Terrain Piece",
      count: 1,
      parentId: unit!.id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/A Unit can contain: Model/);
  });

  test("2026-06-05 — a Model is a legal sub-project under an Army", async () => {
    await createProject({ name: "Hero Army", type: "Army", count: 0 });
    const [army] = await state.db!.select().from(projects);

    // Success path redirects (returns undefined) rather than resolving to
    // an ActionResult — assert via the inserted row + the redirect call,
    // matching the other happy-path createProject tests.
    await createProject({
      name: "Captain Lysander",
      type: "Model",
      count: 1,
      parentId: army!.id,
    });

    const child = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.name, "Captain Lysander"));
    expect(child).toHaveLength(1);
    expect(child[0]!.type).toBe("Model");
    expect(child[0]!.parentId).toBe(army!.id);
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
    if (!res.ok) expect(res.error).toMatch(/A Terrain Piece can't contain sub-projects/);
  });

  test("a Unit nested under an Army can't host another Unit (depth bounded by containment map)", async () => {
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
    // A Unit hosts Models only, so a sub-Unit is rejected by the containment
    // map before the depth cap is ever reached — the tree can't grow a 4th tier.
    if (!res.ok) expect(res.error).toMatch(/A Unit can contain: Model/);
  });

  test("2026-06-23 — a Model IS allowed 3 levels deep (Army → Unit → Model)", async () => {
    await createProject({ name: "Army", type: "Army", count: 0 });
    const [army] = await state.db!.select().from(projects);
    await createProject({
      name: "Squad",
      type: "Unit",
      count: 10,
      parentId: army!.id,
    });
    const [unit] = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.parentId, army!.id));

    await createProject({
      name: "Sergeant",
      type: "Model",
      count: 1,
      parentId: unit!.id,
    });
    const model = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.name, "Sergeant"));
    expect(model).toHaveLength(1);
    expect(model[0]!.type).toBe("Model");
    expect(model[0]!.parentId).toBe(unit!.id);
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
  test("OWNED — sets owned ≥ 1, zeroes the rest", async () => {
    await createProject({ name: "Squad", type: "Unit", count: 10 });
    const [row] = await state.db!.select().from(projects);

    const res = await bumpProjectStatus({ id: row!.id, status: "OWNED" });
    expect(res.ok).toBe(true);

    const [updated] = await state.db!.select().from(projects);
    expect(displayStatus(updated!)).toBe("OWNED");
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

/* ============================================================
   batch/model-warband — setModelClass action
   ============================================================ */

describe("setModelClass", () => {
  test("sets a free-text class on a model row for the owner", async () => {
    await createProject({ name: "Bestigor", type: "Unit", count: 1 });
    const [row] = await state.db!.select().from(projects);

    const res = await setModelClass({ id: row!.id, modelClass: "Leader" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.modelClass).toBe("Leader");

    const [updated] = await state.db!.select().from(projects);
    expect(updated!.modelClass).toBe("Leader");
  });

  test("trims whitespace around the class label", async () => {
    await createProject({ name: "Gor", type: "Unit", count: 1 });
    const [row] = await state.db!.select().from(projects);

    await setModelClass({ id: row!.id, modelClass: "  Champion  " });
    const [updated] = await state.db!.select().from(projects);
    expect(updated!.modelClass).toBe("Champion");
  });

  test("blank input clears the class back to null", async () => {
    await createProject({ name: "Ungor", type: "Unit", count: 1 });
    const [row] = await state.db!.select().from(projects);
    await setModelClass({ id: row!.id, modelClass: "Standard Bearer" });

    const res = await setModelClass({ id: row!.id, modelClass: "   " });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.modelClass).toBeNull();

    const [updated] = await state.db!.select().from(projects);
    expect(updated!.modelClass).toBeNull();
  });

  test("omitted modelClass collapses to null", async () => {
    await createProject({ name: "Centigor", type: "Unit", count: 1 });
    const [row] = await state.db!.select().from(projects);

    const res = await setModelClass({ id: row!.id });
    expect(res.ok).toBe(true);
    const [updated] = await state.db!.select().from(projects);
    expect(updated!.modelClass).toBeNull();
  });

  test("rejects a class over the 40-char cap", async () => {
    await createProject({ name: "Doombull", type: "Unit", count: 1 });
    const [row] = await state.db!.select().from(projects);

    const res = await setModelClass({
      id: row!.id,
      modelClass: "x".repeat(41),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Class is too long/);
  });

  test("does not touch a project owned by a different user", async () => {
    await createProject({ name: "Minotaur", type: "Unit", count: 1 });
    const [row] = await state.db!.select().from(projects);

    state.userId = "intruder";
    const res = await setModelClass({ id: row!.id, modelClass: "Leader" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Project not found/);

    // Original owner's row is untouched.
    const [unchanged] = await state.db!.select().from(projects);
    expect(unchanged!.modelClass).toBeNull();
  });
});

describe("setProjectComplete (focus bench models stepper)", () => {
  test("marking N complete raises the prior stages and respects the cascade", async () => {
    const created = await createProject({ name: "Squad", type: "Unit", count: 10 });
    const id = created.ok ? created.data.id : "";

    const res = await setProjectComplete({ id, complete: 4 });
    expect(res.ok).toBe(true);

    const [row] = await state.db!.select().from(projects).where(eq(projects.id, id));
    expect(row!.completeCount).toBe(4);
    // Every prior stage raised to at least 4; total unchanged (already ≥ 4).
    expect(row!.baseCount).toBe(4);
    expect(row!.paintCount).toBe(4);
    expect(row!.primeCount).toBe(4);
    expect(row!.buildCount).toBe(4);
    expect(row!.ownedCount).toBe(4);
    expect(row!.count).toBe(10);
  });

  test("does not regress a stage the painter already advanced further", async () => {
    const created = await createProject({ name: "Squad", type: "Unit", count: 10 });
    const id = created.ok ? created.data.id : "";
    // Advance build to 8 first via the cascade-aware count path is overkill;
    // set it directly to simulate prior progress.
    await state.db!
      .update(projects)
      .set({ ownedCount: 10, buildCount: 8 })
      .where(eq(projects.id, id));

    const res = await setProjectComplete({ id, complete: 3 });
    expect(res.ok).toBe(true);

    const [row] = await state.db!.select().from(projects).where(eq(projects.id, id));
    expect(row!.completeCount).toBe(3);
    expect(row!.buildCount).toBe(8); // preserved, not lowered
    expect(row!.ownedCount).toBe(10);
  });

  test("rejects an unknown project", async () => {
    const res = await setProjectComplete({ id: "nope", complete: 1 });
    expect(res.ok).toBe(false);
  });
});
