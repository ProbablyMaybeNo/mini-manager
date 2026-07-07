import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { nanoid } from "nanoid";
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

const { listPublishedRecipes } = await import("@/db/queries/recipes");

/** Seeds a recipe. `isListed` defaults true here so most tests exercise the
 *  gallery grid directly — the "unlisted" tests below explicitly override it
 *  to false to prove a shared-but-unlisted recipe never leaks in. */
async function seedRecipe(
  overrides: Partial<typeof recipes.$inferInsert> = {},
): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(recipes).values({
    id,
    ownerId: state.userId,
    name: "Test Recipe",
    bodyType: "infantry",
    isStandalone: true,
    isListed: true,
    ...overrides,
  });
  return id;
}

async function addSlot(
  recipeId: string,
  position: number,
  slot: Partial<typeof recipeSlots.$inferInsert> = {},
): Promise<void> {
  await state.db!.insert(recipeSlots).values({
    id: nanoid(16),
    recipeId,
    position,
    technique: "basecoat",
    ...slot,
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

describe("listPublishedRecipes", () => {
  test("returns only recipes with a public slug (private recipes never leak)", async () => {
    // Private — no slug. Must NOT appear.
    await seedRecipe({ name: "Private Scheme", publicSlug: null });
    // Published — has a slug. Must appear.
    await seedRecipe({ name: "Shared Scheme", publicSlug: "abc123xyz0" });

    const cards = await listPublishedRecipes();
    expect(cards).toHaveLength(1);
    expect(cards[0]?.name).toBe("Shared Scheme");
    expect(cards[0]?.slug).toBe("abc123xyz0");
  });

  test("includes published recipes from every owner (not owner-scoped)", async () => {
    await seedRecipe({ name: "Alice Shared", publicSlug: "alice00000" });

    const bobId = await seedExtraUser(state.db!, "bob");
    const prevUser = state.userId;
    state.userId = bobId;
    await seedRecipe({ name: "Bob Shared", publicSlug: "bob0000000" });
    state.userId = prevUser;

    const cards = await listPublishedRecipes();
    const names = cards.map((c) => c.name).sort();
    expect(names).toEqual(["Alice Shared", "Bob Shared"]);
  });

  test("orders newest (updatedAt desc) first", async () => {
    const older = new Date("2026-01-01T00:00:00Z");
    const newer = new Date("2026-06-01T00:00:00Z");
    await seedRecipe({
      name: "Older",
      publicSlug: "older00000",
      createdAt: older,
      updatedAt: older,
    });
    await seedRecipe({
      name: "Newer",
      publicSlug: "newer00000",
      createdAt: newer,
      updatedAt: newer,
    });

    const cards = await listPublishedRecipes();
    expect(cards.map((c) => c.name)).toEqual(["Newer", "Older"]);
  });

  test("caps the result at the requested limit", async () => {
    for (let i = 0; i < 5; i++) {
      await seedRecipe({ name: `Recipe ${i}`, publicSlug: `slug00000${i}` });
    }
    const cards = await listPublishedRecipes(3);
    expect(cards).toHaveLength(3);
  });

  test("resolves custom-colour swatches and reports slot count", async () => {
    const recipeId = await seedRecipe({
      name: "Custom Colours",
      publicSlug: "custom0000",
    });
    await addSlot(recipeId, 0, { customColorHex: "#112233" });
    await addSlot(recipeId, 1, { customColorHex: "#445566" });

    const cards = await listPublishedRecipes();
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(card.slotCount).toBe(2);
    expect(card.swatches).toEqual(["#112233", "#445566"]);
    // Custom-only slots contribute no brand.
    expect(card.brands).toEqual([]);
  });

  test("a shared-but-unlisted recipe never appears (sharing != listing)", async () => {
    // Mirrors what publishRecipe actually does: mint a publicSlug, leave
    // isListed at its default (false). The recipe is reachable at /r/<slug>
    // but must not show up on the gallery grid.
    await seedRecipe({
      name: "Shared Not Listed",
      publicSlug: "shared0000",
      isListed: false,
    });
    const cards = await listPublishedRecipes();
    expect(cards).toEqual([]);
  });

  test("returns an empty array when nothing is published", async () => {
    await seedRecipe({ name: "Private Only", publicSlug: null });
    const cards = await listPublishedRecipes();
    expect(cards).toEqual([]);
  });
});
