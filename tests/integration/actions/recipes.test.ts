import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { nanoid } from "nanoid";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { projects, recipes } from "@/db/schema";

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

const {
  createRecipe,
  attachRecipeToProject,
  detachRecipe,
  deleteRecipe,
} = await import("@/lib/actions/recipes");

async function seedProject(): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(projects).values({
    id,
    ownerId: state.userId,
    type: "Unit",
    name: "Squad",
    count: 10,
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

describe("createRecipe", () => {
  test("creates a standalone recipe when no attachment given", async () => {
    const res = await createRecipe({ name: "Salamanders" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const [row] = await state.db!.select().from(recipes);
    expect(row!.name).toBe("Salamanders");
    expect(row!.isStandalone).toBe(true);
    expect(row!.attachedProjectId).toBeNull();
  });

  test("creates an attached recipe when projectId given", async () => {
    const projectId = await seedProject();
    const res = await createRecipe({
      name: "For my squad",
      attachedProjectId: projectId,
    });
    expect(res.ok).toBe(true);

    const [row] = await state.db!.select().from(recipes);
    expect(row!.attachedProjectId).toBe(projectId);
    expect(row!.isStandalone).toBe(false);
  });

  test("rejects a project that doesn't exist", async () => {
    const res = await createRecipe({
      name: "Phantom",
      bodyType: "infantry",
      attachedProjectId: "no-such-project",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Project not found/);
  });
});

describe("attach + detach lifecycle", () => {
  test("attach to project then detach restores standalone", async () => {
    const projectId = await seedProject();
    const created = await createRecipe({ name: "R1", bodyType: "infantry" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const recipeId = created.data.id;

    await attachRecipeToProject({ recipeId, projectId });
    let [row] = await state.db!.select().from(recipes);
    expect(row!.attachedProjectId).toBe(projectId);
    expect(row!.isStandalone).toBe(false);

    await detachRecipe({ recipeId });
    [row] = await state.db!.select().from(recipes);
    expect(row!.attachedProjectId).toBeNull();
    expect(row!.isStandalone).toBe(true);
  });

  test("attaching to a different project moves the link", async () => {
    const projectA = await seedProject();
    const projectB = await seedProject();
    const created = await createRecipe({
      name: "R2",
      bodyType: "infantry",
      attachedProjectId: projectA,
    });
    if (!created.ok) throw new Error("setup failed");

    await attachRecipeToProject({
      recipeId: created.data.id,
      projectId: projectB,
    });
    const [row] = await state.db!.select().from(recipes);
    expect(row!.attachedProjectId).toBe(projectB);
    expect(row!.isStandalone).toBe(false);
  });

  test("attaching to a project owned by another user fails", async () => {
    const otherUserId = await seedExtraUser(state.db!);
    const otherProject = nanoid(16);
    await state.db!.insert(projects).values({
      id: otherProject,
      ownerId: otherUserId,
      type: "Unit",
      name: "Not mine",
      count: 5,
    });
    const created = await createRecipe({ name: "R3", bodyType: "infantry" });
    if (!created.ok) throw new Error("setup failed");

    const res = await attachRecipeToProject({
      recipeId: created.data.id,
      projectId: otherProject,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Project not found/);
  });
});

describe("deleteRecipe", () => {
  test("removes the recipe row", async () => {
    const created = await createRecipe({ name: "Doomed", bodyType: "infantry" });
    if (!created.ok) throw new Error("setup failed");

    const res = await deleteRecipe({ id: created.data.id });
    expect(res.ok).toBe(true);

    const rows = await state.db!.select().from(recipes);
    expect(rows).toHaveLength(0);
  });

  test("rejects deletion of a recipe the user doesn't own", async () => {
    const created = await createRecipe({ name: "Mine", bodyType: "infantry" });
    if (!created.ok) throw new Error("setup failed");

    state.userId = "intruder";
    const res = await deleteRecipe({ id: created.data.id });
    expect(res.ok).toBe(false);

    // Still there
    const rows = await state.db!.select().from(recipes);
    expect(rows).toHaveLength(1);
  });

  test.skip("cascade deletes zones + steps (skipped — covered once P3.2 zone actions ship a test pattern)", async () => {
    expect(true).toBe(true);
  });
});

// Sanity: each test starts on a fresh DB.
describe("test isolation", () => {
  test("no rows leak between tests", async () => {
    const rs = await state.db!.select().from(recipes);
    const ps = await state.db!.select().from(projects);
    expect(rs).toHaveLength(0);
    expect(ps).toHaveLength(0);
  });
});
