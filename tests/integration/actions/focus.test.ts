/**
 * P13.11 — Focus widget server actions + query helpers.
 *
 * Covers the dashboard FOCUS feature (2026-06-04 flatten):
 *   1. setFocusProject — persists user.focus_project_id
 *   2. clearFocusProject — nulls it
 *   3. listFocusCandidates / getFocusedRecipeBundle / getFocusProjectId
 *      query helpers used by the dashboard page (flat slot bundle)
 *
 * Tests use the in-memory libsql test DB so the migration + FK actions
 * exercise the production code path; the auth helper and revalidatePath
 * are mocked so the action contract stays observable.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import {
  projects,
  recipes,
  recipeSlots,
  users,
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const focusActions = await import("@/lib/actions/focus");
const focusQueries = await import("@/db/queries/focus");

async function seedProjectWithRecipe(opts: {
  ownerId?: string;
  projectName?: string;
  recipeName?: string;
  withSlot?: boolean;
} = {}) {
  const ownerId = opts.ownerId ?? state.userId;
  const projectId = nanoid(16);
  await state.db!.insert(projects).values({
    id: projectId,
    ownerId,
    type: "Unit",
    name: opts.projectName ?? "Test Squad",
    count: 5,
    ownedCount: 0,
    buildCount: 0,
    primeCount: 0,
    paintCount: 0,
    baseCount: 0,
    completeCount: 0,
  });

  const recipeId = nanoid(16);
  await state.db!.insert(recipes).values({
    id: recipeId,
    ownerId,
    name: opts.recipeName ?? "Test Scheme",
    attachedProjectId: projectId,
    bodyType: "infantry",
  });

  let slotId: string | null = null;
  if (opts.withSlot) {
    slotId = nanoid(16);
    await state.db!.insert(recipeSlots).values({
      id: slotId,
      recipeId,
      position: 0,
      technique: "basecoat",
      customColorHex: "#aabbcc",
    });
  }

  return { projectId, recipeId, slotId };
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

describe("setFocusProject — pins a project onto user.focus_project_id", () => {
  test("happy path persists the focus id", async () => {
    const { projectId } = await seedProjectWithRecipe();
    const res = await focusActions.setFocusProject({ projectId });

    expect(res.ok).toBe(true);

    const [row] = await state
      .db!.select({ focusProjectId: users.focusProjectId })
      .from(users)
      .where(eq(users.id, state.userId));
    expect(row?.focusProjectId).toBe(projectId);
  });

  test("rejects a project owned by another user", async () => {
    const otherId = await seedExtraUser(state.db!, "stranger");
    const { projectId } = await seedProjectWithRecipe({ ownerId: otherId });
    const res = await focusActions.setFocusProject({ projectId });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not found/i);

    const [row] = await state
      .db!.select({ focusProjectId: users.focusProjectId })
      .from(users)
      .where(eq(users.id, state.userId));
    expect(row?.focusProjectId).toBeNull();
  });

  test("rejects an invalid id payload", async () => {
    const res = await focusActions.setFocusProject({ projectId: "" });
    expect(res.ok).toBe(false);
  });
});

describe("clearFocusProject — nulls the focus", () => {
  test("sets focus_project_id back to null", async () => {
    const { projectId } = await seedProjectWithRecipe();
    await focusActions.setFocusProject({ projectId });

    const res = await focusActions.clearFocusProject();
    expect(res.ok).toBe(true);

    const [row] = await state
      .db!.select({ focusProjectId: users.focusProjectId })
      .from(users)
      .where(eq(users.id, state.userId));
    expect(row?.focusProjectId).toBeNull();
  });

  test("is idempotent — clearing when nothing is set still succeeds", async () => {
    const res = await focusActions.clearFocusProject();
    expect(res.ok).toBe(true);
  });
});

describe("query helpers (P13.11)", () => {
  test("listFocusCandidates returns only projects with attached recipes", async () => {
    const { projectId: projectWithRecipe } = await seedProjectWithRecipe({
      projectName: "Squad A",
    });

    // Seed a second project WITHOUT a recipe — should not appear.
    await state.db!.insert(projects).values({
      id: nanoid(16),
      ownerId: state.userId,
      type: "Unit",
      name: "Naked squad",
      count: 1,
    });

    const candidates = await focusQueries.listFocusCandidates(state.userId);
    expect(candidates.map((c) => c.id)).toEqual([projectWithRecipe]);
    expect(candidates[0]?.name).toBe("Squad A");
  });

  test("listFocusCandidates dedupes a project that has multiple attached recipes", async () => {
    const { projectId, recipeId } = await seedProjectWithRecipe();
    // Add a second recipe attached to the same project.
    await state.db!.insert(recipes).values({
      id: nanoid(16),
      ownerId: state.userId,
      name: "Second scheme",
      attachedProjectId: projectId,
      bodyType: "infantry",
    });
    const candidates = await focusQueries.listFocusCandidates(state.userId);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.id).toBe(projectId);
    void recipeId;
  });

  test("listFocusCandidates excludes other users' projects", async () => {
    await seedProjectWithRecipe();
    const otherId = await seedExtraUser(state.db!, "rival");
    await seedProjectWithRecipe({ ownerId: otherId });

    const mine = await focusQueries.listFocusCandidates(state.userId);
    expect(mine).toHaveLength(1);
  });

  test("getFocusProjectId returns null when no focus is pinned", async () => {
    const id = await focusQueries.getFocusProjectId(state.userId);
    expect(id).toBeNull();
  });

  test("getFocusedRecipeBundle returns null when no focus is set", async () => {
    const bundle = await focusQueries.getFocusedRecipeBundle(state.userId);
    expect(bundle).toBeNull();
  });

  test("getFocusedRecipeBundle returns project + recipe + slots when focus is set", async () => {
    const { projectId } = await seedProjectWithRecipe({ withSlot: true });
    await focusActions.setFocusProject({ projectId });

    const bundle = await focusQueries.getFocusedRecipeBundle(state.userId);
    expect(bundle).not.toBeNull();
    expect(bundle!.project.id).toBe(projectId);
    expect(bundle!.slots).toHaveLength(1);
    expect(bundle!.slots[0]?.technique).toBe("basecoat");
    // UX-907 — bundle reports the full attached-recipe list so the tab
    // strip has the data it needs without an extra round-trip.
    expect(bundle!.allRecipes).toHaveLength(1);
  });

  test("getFocusedRecipeBundle exposes ALL attached recipes (UX-907)", async () => {
    const { projectId, recipeId } = await seedProjectWithRecipe({
      recipeName: "Older scheme",
    });
    // Add a second + third recipe attached to the same project. Set
    // updatedAt explicitly so the most-recently-updated ordering is
    // deterministic (default $defaultFn resolves to Date.now() which
    // can collide across rows inserted in the same millisecond).
    const base = Date.now();
    // Bump the first recipe's updatedAt to the oldest known timestamp.
    await state.db!
      .update(recipes)
      .set({ updatedAt: new Date(base - 2_000) })
      .where(eq(recipes.id, recipeId));
    const second = nanoid(16);
    await state.db!.insert(recipes).values({
      id: second,
      ownerId: state.userId,
      name: "Middle scheme",
      attachedProjectId: projectId,
      bodyType: "infantry",
      updatedAt: new Date(base - 1_000),
    });
    const third = nanoid(16);
    await state.db!.insert(recipes).values({
      id: third,
      ownerId: state.userId,
      name: "Newest scheme",
      attachedProjectId: projectId,
      bodyType: "infantry",
      updatedAt: new Date(base),
    });

    await focusActions.setFocusProject({ projectId });
    const bundle = await focusQueries.getFocusedRecipeBundle(state.userId);
    expect(bundle).not.toBeNull();
    // All three recipes appear in the tab list.
    expect(bundle!.allRecipes).toHaveLength(3);
    // Default selection = head of the list (most-recently-updated).
    expect(bundle!.allRecipes[0]?.id).toBe(third);
    expect(bundle!.recipe.id).toBe(third);
  });

  test("getFocusedRecipeBundle honours preferredRecipeId (UX-907)", async () => {
    const { projectId, recipeId: firstId } = await seedProjectWithRecipe();
    const base = Date.now();
    await state.db!
      .update(recipes)
      .set({ updatedAt: new Date(base - 1_000) })
      .where(eq(recipes.id, firstId));
    const secondId = nanoid(16);
    await state.db!.insert(recipes).values({
      id: secondId,
      ownerId: state.userId,
      name: "Second scheme",
      attachedProjectId: projectId,
      bodyType: "infantry",
      updatedAt: new Date(base),
    });

    await focusActions.setFocusProject({ projectId });

    // Without preference — picks newest (secondId has the later
    // updatedAt by 1s).
    const def = await focusQueries.getFocusedRecipeBundle(state.userId);
    expect(def!.recipe.id).toBe(secondId);

    // With explicit preference — picks the requested recipe.
    const pref = await focusQueries.getFocusedRecipeBundle(
      state.userId,
      firstId,
    );
    expect(pref!.recipe.id).toBe(firstId);
    expect(pref!.allRecipes.map((r) => r.id)).toContain(firstId);
  });

  test("getFocusedRecipeBundle falls back to default when preferredRecipeId is unowned/unknown (UX-907)", async () => {
    const { projectId } = await seedProjectWithRecipe();
    await focusActions.setFocusProject({ projectId });

    const bundle = await focusQueries.getFocusedRecipeBundle(
      state.userId,
      "totally-bogus-id",
    );
    // Bogus id silently falls back instead of returning null — the
    // dashboard stays renderable when the URL param is stale.
    expect(bundle).not.toBeNull();
  });

  test("ON DELETE SET NULL — deleting the focused project nulls the focus", async () => {
    const { projectId } = await seedProjectWithRecipe();
    await focusActions.setFocusProject({ projectId });

    // Sanity: focus is set.
    const before = await focusQueries.getFocusProjectId(state.userId);
    expect(before).toBe(projectId);

    // The libsql test DB defaults `PRAGMA foreign_keys = OFF`. Turn
    // it on so the FK action fires (this matches the production
    // libsql behaviour, which has FKs enforced by default).
    await state.db!.run("PRAGMA foreign_keys = ON");

    // Delete the project — FK ON DELETE SET NULL should null the focus.
    await state.db!.delete(projects).where(eq(projects.id, projectId));

    const after = await focusQueries.getFocusProjectId(state.userId);
    expect(after).toBeNull();
  });
});
