import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { recipes, recipeSteps, recipeZones } from "@/db/schema";

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
const { addZone } = await import("@/lib/actions/recipeZones");

async function stepsFor(zoneId: string) {
  return state.db!
    .select()
    .from(recipeSteps)
    .where(eq(recipeSteps.zoneId, zoneId))
    .orderBy(asc(recipeSteps.position));
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
  test("creates a standalone recipe with a Palette zone and one step per colour", async () => {
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#0e4a8a" }, { hex: "#33ff66" }, { hex: "#ffaa00" }],
      newRecipeName: "Triadic Scheme",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.insertedStepIds).toHaveLength(3);

    const [recipe] = await state.db!
      .select()
      .from(recipes)
      .where(eq(recipes.id, res.data.recipeId));
    expect(recipe!.name).toBe("Triadic Scheme");
    expect(recipe!.isStandalone).toBe(true);

    const [zone] = await state.db!
      .select()
      .from(recipeZones)
      .where(eq(recipeZones.id, res.data.zoneId));
    expect(zone!.name).toBe("Palette");

    const steps = await stepsFor(res.data.zoneId);
    expect(steps.map((s) => s.customColorHex)).toEqual([
      "#0E4A8A",
      "#33FF66",
      "#FFAA00",
    ]);
    expect(steps.every((s) => s.paintId === null)).toBe(true);
    expect(steps.every((s) => s.technique === "basecoat")).toBe(true);
  });

  test("a swatch carrying a paintId pins the paint and clears the custom hex", async () => {
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#0e4a8a", paintId: "citadel-macragge-blue" }],
      newRecipeName: "Pinned",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const steps = await stepsFor(res.data.zoneId);
    expect(steps[0]!.paintId).toBe("citadel-macragge-blue");
    expect(steps[0]!.customColorHex).toBeNull();
  });
});

describe("sendPaletteToRecipe — append to existing", () => {
  async function seedRecipeWithZone(): Promise<{
    recipeId: string;
    zoneId: string;
  }> {
    const recipe = await createRecipe({ name: "Host", bodyType: "infantry" });
    if (!recipe.ok) throw new Error("recipe seed failed");
    const zone = await addZone({ recipeId: recipe.data.id, name: "Armor" });
    if (!zone.ok) throw new Error("zone seed failed");
    return { recipeId: recipe.data.id, zoneId: zone.data.id };
  }

  test("appends steps into an existing zone", async () => {
    const { recipeId, zoneId } = await seedRecipeWithZone();
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#111111" }, { hex: "#222222" }],
      targetRecipeId: recipeId,
      targetZoneId: zoneId,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.zoneId).toBe(zoneId);
    const steps = await stepsFor(zoneId);
    expect(steps.map((s) => s.customColorHex)).toEqual(["#111111", "#222222"]);
  });

  test("creates a new zone when no target zone is supplied", async () => {
    const { recipeId } = await seedRecipeWithZone();
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#abcdef" }],
      targetRecipeId: recipeId,
      zoneName: "From Eyedropper",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const zones = await state.db!
      .select()
      .from(recipeZones)
      .where(eq(recipeZones.recipeId, recipeId))
      .orderBy(asc(recipeZones.position));
    expect(zones).toHaveLength(2);
    expect(zones[1]!.name).toBe("From Eyedropper");
  });

  test("rejects a zone that belongs to a different recipe", async () => {
    const a = await seedRecipeWithZone();
    const b = await seedRecipeWithZone();
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#000000" }],
      targetRecipeId: a.recipeId,
      targetZoneId: b.zoneId,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Zone not found in this recipe/);
  });

  test("cannot append to another user's recipe", async () => {
    const { recipeId } = await seedRecipeWithZone();
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

  test("returns the user's recipes with their zones", async () => {
    const recipe = await createRecipe({ name: "Listed", bodyType: "infantry" });
    if (!recipe.ok) throw new Error("seed failed");
    await addZone({ recipeId: recipe.data.id, name: "Z1" });
    await addZone({ recipeId: recipe.data.id, name: "Z2" });

    const res = await listRecipesForSendTo();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(1);
    expect(res.data[0]!.name).toBe("Listed");
    expect(res.data[0]!.zones.map((z) => z.name)).toEqual(["Z1", "Z2"]);
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
