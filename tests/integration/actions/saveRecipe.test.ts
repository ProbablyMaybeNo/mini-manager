/**
 * saveRecipe — the kit editor's whole-recipe save. Covers the inspo
 * round-trip added alongside the focus-bench wiring: passing `inspo`
 * replaces the recipe's inspiration set wholesale, and omitting it leaves
 * existing inspo untouched. Runs against a real in-memory libsql DB.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { recipeInspo, recipeSlots, recipes } from "@/db/schema";

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

async function notesFor(recipeId: string): Promise<string | null> {
  const [row] = await state
    .db!.select({ notesMd: recipes.notesMd })
    .from(recipes)
    .where(eq(recipes.id, recipeId));
  return row?.notesMd ?? null;
}

async function slotHexesFor(recipeId: string): Promise<Array<string | null>> {
  const rows = await state
    .db!.select()
    .from(recipeSlots)
    .where(eq(recipeSlots.recipeId, recipeId))
    .orderBy(asc(recipeSlots.position));
  return rows.map((r) => r.customColorHex);
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

describe("saveRecipe slot transactionality (E1)", () => {
  test("a mid-save failure leaves the original slots intact", async () => {
    // Seed a recipe with two valid custom-colour slots.
    const created = await saveRecipe({
      id: "new",
      name: "Original",
      slots: [
        { paintId: null, hex: "#111111", layer: "basecoat" },
        { paintId: null, hex: "#222222", layer: "highlight" },
      ],
    });
    expect(created.ok).toBe(true);
    const id = created.ok ? created.data.id : "";
    expect(await slotHexesFor(id)).toEqual(["#111111", "#222222"]);

    // Re-save with a new set whose second slot has a malformed hex — addSlot
    // rejects it, so the wholesale replace fails partway through.
    const res = await saveRecipe({
      id,
      name: "Original",
      slots: [
        { paintId: null, hex: "#333333", layer: "basecoat" },
        { paintId: null, hex: "not-a-hex", layer: "highlight" },
      ],
    });
    expect(res.ok).toBe(false);

    // The original slot set is restored — no truncation, no partial write.
    expect(await slotHexesFor(id)).toEqual(["#111111", "#222222"]);
  });
});

describe("saveRecipe notes persistence", () => {
  test("persists notesMd when creating a new recipe", async () => {
    const res = await saveRecipe({
      id: "new",
      name: "Blue Scheme",
      slots: [],
      notesMd: "Varnish with a matte topcoat once fully dry.",
    });
    expect(res.ok).toBe(true);
    const id = res.ok ? res.data.id : "";
    expect(await notesFor(id)).toBe("Varnish with a matte topcoat once fully dry.");
  });

  test("updates notesMd on an existing recipe", async () => {
    const created = await saveRecipe({ id: "new", name: "Scheme", slots: [] });
    const id = created.ok ? created.data.id : "";
    expect(await notesFor(id)).toBeNull();

    await saveRecipe({
      id,
      name: "Scheme",
      slots: [],
      notesMd: "Base coat twice for full coverage.",
    });
    expect(await notesFor(id)).toBe("Base coat twice for full coverage.");

    // Re-save with an empty string clears it to null rather than storing "".
    await saveRecipe({ id, name: "Scheme", slots: [], notesMd: "" });
    expect(await notesFor(id)).toBeNull();
  });

  test("omitting notesMd leaves the existing value untouched", async () => {
    const created = await saveRecipe({
      id: "new",
      name: "Scheme",
      slots: [],
      notesMd: "Keep this note.",
    });
    const id = created.ok ? created.data.id : "";

    await saveRecipe({ id, name: "Renamed", slots: [] });
    expect(await notesFor(id)).toBe("Keep this note.");
  });
});
