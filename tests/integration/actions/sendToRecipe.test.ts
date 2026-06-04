import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { recipes, recipeSlots } from "@/db/schema";

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

const { sendPaletteToRecipe, listRecipesForSendTo } = await import(
  "@/lib/actions/sendToRecipe"
);
const { createRecipe } = await import("@/lib/actions/recipes");

async function slotsFor(recipeId: string) {
  return state.db!
    .select()
    .from(recipeSlots)
    .where(eq(recipeSlots.recipeId, recipeId))
    .orderBy(asc(recipeSlots.position));
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

describe("sendPaletteToRecipe — new recipe (the ship criterion)", () => {
  test("creates a standalone recipe with one slot per colour", async () => {
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#0e4a8a" }, { hex: "#33ff66" }, { hex: "#ffaa00" }],
      newRecipeName: "Triadic Scheme",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.insertedSlotIds).toHaveLength(3);

    const [recipe] = await state.db!
      .select()
      .from(recipes)
      .where(eq(recipes.id, res.data.recipeId));
    expect(recipe!.name).toBe("Triadic Scheme");
    expect(recipe!.isStandalone).toBe(true);

    const slots = await slotsFor(res.data.recipeId);
    expect(slots.map((s) => s.customColorHex)).toEqual([
      "#0E4A8A",
      "#33FF66",
      "#FFAA00",
    ]);
    expect(slots.every((s) => s.paintId === null)).toBe(true);
    expect(slots.every((s) => s.technique === "basecoat")).toBe(true);
  });

  test("a swatch carrying a paintId pins the paint and clears the custom hex", async () => {
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#0e4a8a", paintId: "citadel-macragge-blue" }],
      newRecipeName: "Pinned",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const slots = await slotsFor(res.data.recipeId);
    expect(slots[0]!.paintId).toBe("citadel-macragge-blue");
    expect(slots[0]!.customColorHex).toBeNull();
  });
});

describe("sendPaletteToRecipe — append to existing", () => {
  async function seedRecipe(): Promise<{ recipeId: string }> {
    const recipe = await createRecipe({ name: "Host", bodyType: "infantry" });
    if (!recipe.ok) throw new Error("recipe seed failed");
    return { recipeId: recipe.data.id };
  }

  test("appends slots onto an existing recipe", async () => {
    const { recipeId } = await seedRecipe();
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#111111" }, { hex: "#222222" }],
      targetRecipeId: recipeId,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.recipeId).toBe(recipeId);
    const slots = await slotsFor(recipeId);
    expect(slots.map((s) => s.customColorHex)).toEqual(["#111111", "#222222"]);
  });

  test("appends after any existing slots, preserving position order", async () => {
    const { recipeId } = await seedRecipe();
    await sendPaletteToRecipe({
      swatches: [{ hex: "#aaaaaa" }],
      targetRecipeId: recipeId,
    });
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#bbbbbb" }],
      targetRecipeId: recipeId,
    });
    expect(res.ok).toBe(true);
    const slots = await slotsFor(recipeId);
    expect(slots.map((s) => s.customColorHex)).toEqual(["#AAAAAA", "#BBBBBB"]);
    expect(slots.map((s) => s.position)).toEqual([0, 1]);
  });

  test("cannot append to another user's recipe", async () => {
    const { recipeId } = await seedRecipe();
    state.userId = await seedExtraUser(state.db!);
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#000000" }],
      targetRecipeId: recipeId,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Recipe not found/);
  });
});

describe("sendPaletteToRecipe — validation", () => {
  test("rejects supplying both a target recipe and a new recipe name", async () => {
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#000000" }],
      targetRecipeId: "some-id",
      newRecipeName: "Conflict",
    });
    expect(res.ok).toBe(false);
  });

  test("rejects supplying neither target", async () => {
    const res = await sendPaletteToRecipe({ swatches: [{ hex: "#000000" }] });
    expect(res.ok).toBe(false);
  });

  test("rejects an empty palette", async () => {
    const res = await sendPaletteToRecipe({
      swatches: [],
      newRecipeName: "Empty",
    });
    expect(res.ok).toBe(false);
  });

  test("rejects a malformed swatch hex", async () => {
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "not-a-hex" }],
      newRecipeName: "Bad",
    });
    expect(res.ok).toBe(false);
  });
});

describe("listRecipesForSendTo", () => {
  test("returns an empty list when the user has no recipes", async () => {
    const res = await listRecipesForSendTo();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual([]);
  });

  test("returns the user's recipes", async () => {
    const recipe = await createRecipe({ name: "Listed", bodyType: "infantry" });
    if (!recipe.ok) throw new Error("seed failed");

    const res = await listRecipesForSendTo();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(1);
    expect(res.data[0]!.name).toBe("Listed");
  });

  test("does not surface another user's recipes", async () => {
    const recipe = await createRecipe({ name: "Mine", bodyType: "infantry" });
    if (!recipe.ok) throw new Error("seed failed");
    state.userId = await seedExtraUser(state.db!);
    const res = await listRecipesForSendTo();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual([]);
  });
});
