import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
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

const { publishRecipe, unpublishRecipe } = await import(
  "@/lib/actions/recipeSharing"
);
const { getRecipeBySlug } = await import("@/db/queries/recipes");

async function seedRecipe(overrides: Partial<typeof recipes.$inferInsert> = {}) {
  const id = nanoid(16);
  await state.db!.insert(recipes).values({
    id,
    ownerId: state.userId,
    name: "Salamanders Power Armor",
    bodyType: "infantry",
    isStandalone: true,
    ...overrides,
  });
  return id;
}

async function seedRecipeWithContent(): Promise<string> {
  const recipeId = await seedRecipe({ name: "Loaded Recipe" });
  const zoneId = nanoid(16);
  await state.db!.insert(recipeZones).values({
    id: zoneId,
    recipeId,
    position: 0,
    name: "Power Armor",
    silhouetteZoneId: "armor-primary",
  });
  await state.db!.insert(recipeSteps).values({
    id: nanoid(16),
    zoneId,
    position: 0,
    technique: "basecoat",
    paintId: "citadel-caliban-green",
  });
  return recipeId;
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

describe("publishRecipe", () => {
  test("mints a 10-char slug and persists it", async () => {
    const recipeId = await seedRecipe();
    const res = await publishRecipe({ recipeId });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.slug).toHaveLength(10);

    const [row] = await state
      .db!.select({ publicSlug: recipes.publicSlug })
      .from(recipes)
      .where(eq(recipes.id, recipeId));
    expect(row?.publicSlug).toBe(res.data.slug);
  });

  test("idempotent — second call returns the same slug", async () => {
    const recipeId = await seedRecipe();
    const first = await publishRecipe({ recipeId });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = await publishRecipe({ recipeId });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.slug).toBe(first.data.slug);
  });

  test("rejects a recipe owned by another user", async () => {
    const recipeId = await seedRecipe();
    state.userId = nanoid(16);
    const res = await publishRecipe({ recipeId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not found/i);
  });
});

describe("unpublishRecipe", () => {
  test("clears the slug after publish", async () => {
    const recipeId = await seedRecipe();
    const pub = await publishRecipe({ recipeId });
    expect(pub.ok).toBe(true);

    const unpub = await unpublishRecipe({ recipeId });
    expect(unpub.ok).toBe(true);

    const [row] = await state
      .db!.select({ publicSlug: recipes.publicSlug })
      .from(recipes)
      .where(eq(recipes.id, recipeId));
    expect(row?.publicSlug).toBeNull();
  });

  test("idempotent — unpublishing an already-unpublished recipe is a no-op", async () => {
    const recipeId = await seedRecipe();
    const res = await unpublishRecipe({ recipeId });
    expect(res.ok).toBe(true);
  });

  test("rejects a recipe owned by another user", async () => {
    const recipeId = await seedRecipe();
    state.userId = nanoid(16);
    const res = await unpublishRecipe({ recipeId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not found/i);
  });
});

describe("getRecipeBySlug", () => {
  test("round-trips a published recipe with its zones and steps", async () => {
    const recipeId = await seedRecipeWithContent();
    const pub = await publishRecipe({ recipeId });
    expect(pub.ok).toBe(true);
    if (!pub.ok) return;

    const fetched = await getRecipeBySlug(pub.data.slug);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(recipeId);
    expect(fetched?.name).toBe("Loaded Recipe");
    expect(fetched?.zones).toHaveLength(1);
    expect(fetched?.zones[0]?.steps).toHaveLength(1);
    expect(fetched?.zones[0]?.steps[0]?.technique).toBe("basecoat");
  });

  test("returns null for an unknown slug", async () => {
    const fetched = await getRecipeBySlug("does-not-exist");
    expect(fetched).toBeNull();
  });

  test("returns null after unpublish", async () => {
    const recipeId = await seedRecipeWithContent();
    const pub = await publishRecipe({ recipeId });
    if (!pub.ok) throw new Error("setup failed");
    await unpublishRecipe({ recipeId });
    const fetched = await getRecipeBySlug(pub.data.slug);
    expect(fetched).toBeNull();
  });
});
