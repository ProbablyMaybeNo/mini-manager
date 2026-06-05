/**
 * Item 4 — recipe inspo actions. A recipe owns a flat ordered list of
 * inspo links / image URLs; add appends with an incrementing position,
 * delete removes a row, both are ownership-scoped, and listInspoForRecipe
 * reads them back in position order. Runs against a real in-memory libsql
 * DB with all migrations applied (so recipe_inspo exists).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { recipeInspo } from "@/db/schema";

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

const { createRecipe } = await import("@/lib/actions/recipes");
const { addInspo, deleteInspo } = await import("@/lib/actions/recipeInspo");
const { listInspoForRecipe } = await import("@/db/queries/recipes");

async function seedRecipe(): Promise<string> {
  const res = await createRecipe({ name: "Inspo Recipe", bodyType: "infantry" });
  if (!res.ok) throw new Error("recipe seed failed");
  return res.data.id;
}

async function inspoFor(recipeId: string) {
  return state.db!
    .select()
    .from(recipeInspo)
    .where(eq(recipeInspo.recipeId, recipeId))
    .orderBy(asc(recipeInspo.position));
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

describe("addInspo", () => {
  test("appends links with incrementing positions; optional label", async () => {
    const recipeId = await seedRecipe();
    await addInspo({ recipeId, url: "https://example.com/a" });
    await addInspo({
      recipeId,
      url: "https://example.com/b",
      label: "Tutorial",
    });

    const rows = await inspoFor(recipeId);
    expect(rows.map((r) => r.position)).toEqual([0, 1]);
    expect(rows.map((r) => r.url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
    expect(rows[0]?.label).toBeNull();
    expect(rows[1]?.label).toBe("Tutorial");
  });

  test("rejects a non-URL value", async () => {
    const recipeId = await seedRecipe();
    const res = await addInspo({ recipeId, url: "not a url" });
    expect(res.ok).toBe(false);
  });

  test("rejects a recipe the user does not own", async () => {
    const recipeId = await seedRecipe();
    state.userId = "intruder";
    const res = await addInspo({ recipeId, url: "https://example.com" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Recipe not found/);
  });
});

describe("deleteInspo", () => {
  test("removes the row", async () => {
    const recipeId = await seedRecipe();
    const added = await addInspo({ recipeId, url: "https://doomed.example" });
    if (!added.ok) throw new Error("setup");
    const res = await deleteInspo({ id: added.data.id });
    expect(res.ok).toBe(true);
    expect(await inspoFor(recipeId)).toHaveLength(0);
  });

  test("cannot delete inspo in another user's recipe", async () => {
    const recipeId = await seedRecipe();
    const added = await addInspo({ recipeId, url: "https://mine.example" });
    if (!added.ok) throw new Error("setup");
    state.userId = "intruder";
    const res = await deleteInspo({ id: added.data.id });
    expect(res.ok).toBe(false);
    expect(await inspoFor(recipeId)).toHaveLength(1);
  });
});

describe("listInspoForRecipe", () => {
  test("reads rows back in position order", async () => {
    const recipeId = await seedRecipe();
    await addInspo({ recipeId, url: "https://one.example" });
    await addInspo({ recipeId, url: "https://two.example" });

    const rows = await listInspoForRecipe(recipeId);
    expect(rows.map((r) => r.url)).toEqual([
      "https://one.example",
      "https://two.example",
    ]);
  });
});
