/**
 * saveRecipe — the kit editor's whole-recipe save. Covers the inspo
 * round-trip added alongside the focus-bench wiring: passing `inspo`
 * replaces the recipe's inspiration set wholesale, and omitting it leaves
 * existing inspo untouched. Runs against a real in-memory libsql DB.
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

const { saveRecipe } = await import("@/lib/actions/saveRecipe");

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

describe("saveRecipe inspo persistence", () => {
  test("creates inspo rows in order when saving a new recipe", async () => {
    const res = await saveRecipe({
      id: "new",
      name: "Blue Scheme",
      slots: [],
      inspo: ["https://a.example/1", "  ", "https://b.example/2"],
    });
    expect(res.ok).toBe(true);
    const id = res.ok ? res.data.id : "";

    const rows = await inspoFor(id);
    // Blank entries are filtered; order preserved.
    expect(rows.map((r) => r.url)).toEqual([
      "https://a.example/1",
      "https://b.example/2",
    ]);
    expect(rows.map((r) => r.position)).toEqual([0, 1]);
  });

  test("replaces the inspo set wholesale on re-save", async () => {
    const created = await saveRecipe({
      id: "new",
      name: "Scheme",
      slots: [],
      inspo: ["https://old.example/1"],
    });
    const id = created.ok ? created.data.id : "";

    await saveRecipe({
      id,
      name: "Scheme",
      slots: [],
      inspo: ["https://new.example/1", "https://new.example/2"],
    });

    const rows = await inspoFor(id);
    expect(rows.map((r) => r.url)).toEqual([
      "https://new.example/1",
      "https://new.example/2",
    ]);
  });

  test("omitting inspo leaves existing rows untouched", async () => {
    const created = await saveRecipe({
      id: "new",
      name: "Scheme",
      slots: [],
      inspo: ["https://keep.example/1"],
    });
    const id = created.ok ? created.data.id : "";

    await saveRecipe({ id, name: "Renamed", slots: [] });

    const rows = await inspoFor(id);
    expect(rows.map((r) => r.url)).toEqual(["https://keep.example/1"]);
  });
});
