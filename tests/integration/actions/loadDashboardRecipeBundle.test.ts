/**
 * B3 / P5 — the combined dashboard recipe read must be byte-identical to the
 * three separate reads it replaces (listRecipesForTable + getProjectPalettesMap
 * + getInspoMapForOwner), just with `recipe`/`recipe_slot`/`recipe_inspo` read
 * once each instead of per-consumer. Runs against a real in-memory libsql DB.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { projects, recipes, recipeSlots, recipeInspo } from "@/db/schema";

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

const {
  loadDashboardRecipeBundle,
  listRecipesForTable,
  getProjectPalettesMap,
  getInspoMapForOwner,
} = await import("@/db/queries/recipes");

async function seedProject(name: string): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(projects).values({
    id,
    ownerId: state.userId,
    name,
    type: "Unit",
  });
  return id;
}

async function seedRecipe(overrides: Partial<typeof recipes.$inferInsert> = {}): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(recipes).values({
    id,
    ownerId: state.userId,
    name: `Recipe ${id.slice(0, 4)}`,
    bodyType: "infantry",
    isStandalone: overrides.attachedProjectId ? false : true,
    ...overrides,
  });
  return id;
}

async function seedSlot(recipeId: string, position: number, hex: string) {
  await state.db!.insert(recipeSlots).values({
    id: nanoid(16),
    recipeId,
    position,
    technique: "basecoat",
    customColorHex: hex,
  });
}

async function seedInspo(recipeId: string, position: number, url: string) {
  await state.db!.insert(recipeInspo).values({
    id: nanoid(16),
    recipeId,
    position,
    url,
    imageUrl: `${url}/thumb.png`,
  });
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

describe("loadDashboardRecipeBundle", () => {
  test("matches the three separate reads it replaces", async () => {
    const projectId = await seedProject("Salamanders");
    const attached = await seedRecipe({ name: "Attached", attachedProjectId: projectId });
    await seedSlot(attached, 0, "#112233");
    await seedSlot(attached, 1, "#445566");
    await seedInspo(attached, 0, "https://example.com/a");
    await seedInspo(attached, 1, "https://example.com/b");

    const standalone = await seedRecipe({ name: "Standalone" });
    await seedSlot(standalone, 0, "#778899");

    const bundle = await loadDashboardRecipeBundle(state.userId);
    const [rows, palettes, inspo] = await Promise.all([
      listRecipesForTable(state.userId),
      getProjectPalettesMap(state.userId),
      getInspoMapForOwner(state.userId),
    ]);

    expect(bundle.recipeRows).toEqual(rows);
    expect([...bundle.palettesMap.entries()]).toEqual([...palettes.entries()]);
    expect([...bundle.inspoMap.entries()]).toEqual([...inspo.entries()]);
    // Sanity: the seeded data actually populated each shape.
    expect(bundle.recipeRows).toHaveLength(2);
    expect(bundle.palettesMap.get(projectId)).toEqual(["#112233", "#445566"]);
    expect(bundle.inspoMap.get(attached)).toHaveLength(2);
  });

  test("returns empty shapes for a user with no recipes", async () => {
    const bundle = await loadDashboardRecipeBundle(state.userId);
    expect(bundle.recipeRows).toEqual([]);
    expect(bundle.palettesMap.size).toBe(0);
    expect(bundle.inspoMap.size).toBe(0);
  });
});
