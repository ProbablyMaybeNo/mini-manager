import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
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

const { publishRecipe, unpublishRecipe, cloneRecipeFromSlug } = await import(
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

describe("cloneRecipeFromSlug", () => {
  test("deep-copies a recipe including zones and steps under the caller", async () => {
    // Alice owns + publishes the source.
    const aliceId = state.userId;
    const sourceId = await seedRecipeWithContent();
    const pub = await publishRecipe({ recipeId: sourceId });
    if (!pub.ok) throw new Error("setup failed");

    // Switch to Bob.
    const bobId = await seedExtraUser(state.db!, "bob");
    state.userId = bobId;

    const clone = await cloneRecipeFromSlug({ slug: pub.data.slug });
    expect(clone.ok).toBe(true);
    if (!clone.ok) return;

    // The clone is a brand-new row with a different id.
    expect(clone.data.id).not.toBe(sourceId);

    // Source still belongs to Alice and remains intact.
    const sourceRows = await state
      .db!.select()
      .from(recipes)
      .where(eq(recipes.id, sourceId));
    expect(sourceRows[0]?.ownerId).toBe(aliceId);
    expect(sourceRows[0]?.publicSlug).toBe(pub.data.slug);

    // Clone belongs to Bob, has the renamed title, no slug, standalone.
    const cloneRows = await state
      .db!.select()
      .from(recipes)
      .where(eq(recipes.id, clone.data.id));
    const cloneRow = cloneRows[0]!;
    expect(cloneRow.ownerId).toBe(bobId);
    expect(cloneRow.name).toBe("Loaded Recipe (cloned)");
    expect(cloneRow.publicSlug).toBeNull();
    expect(cloneRow.isStandalone).toBe(true);
    expect(cloneRow.attachedProjectId).toBeNull();

    // Zones + steps replicated 1:1 under fresh ids.
    const zones = await state
      .db!.select()
      .from(recipeZones)
      .where(eq(recipeZones.recipeId, clone.data.id));
    expect(zones).toHaveLength(1);
    expect(zones[0]?.name).toBe("Power Armor");
    expect(zones[0]?.silhouetteZoneId).toBe("armor-primary");

    const steps = await state
      .db!.select()
      .from(recipeSteps)
      .where(eq(recipeSteps.zoneId, zones[0]!.id));
    expect(steps).toHaveLength(1);
    expect(steps[0]?.technique).toBe("basecoat");
    expect(steps[0]?.paintId).toBe("citadel-caliban-green");
  });

  test("rejects cloning a recipe you already own", async () => {
    const recipeId = await seedRecipeWithContent();
    const pub = await publishRecipe({ recipeId });
    if (!pub.ok) throw new Error("setup failed");

    const res = await cloneRecipeFromSlug({ slug: pub.data.slug });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/already your recipe/i);
  });

  test("renames consecutive clones with (cloned 2), (cloned 3)…", async () => {
    const sourceId = await seedRecipeWithContent();
    const pub = await publishRecipe({ recipeId: sourceId });
    if (!pub.ok) throw new Error("setup failed");

    const bobId = await seedExtraUser(state.db!, "bob");
    state.userId = bobId;

    const c1 = await cloneRecipeFromSlug({ slug: pub.data.slug });
    const c2 = await cloneRecipeFromSlug({ slug: pub.data.slug });
    const c3 = await cloneRecipeFromSlug({ slug: pub.data.slug });
    expect(c1.ok && c2.ok && c3.ok).toBe(true);

    const names = await state
      .db!.select({ name: recipes.name })
      .from(recipes)
      .where(eq(recipes.ownerId, bobId));
    const nameSet = new Set(names.map((r) => r.name));
    expect(nameSet.has("Loaded Recipe (cloned)")).toBe(true);
    expect(nameSet.has("Loaded Recipe (cloned 2)")).toBe(true);
    expect(nameSet.has("Loaded Recipe (cloned 3)")).toBe(true);
  });

  test("rejects an unknown slug", async () => {
    const res = await cloneRecipeFromSlug({ slug: "nopenope" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not found/i);
  });

  test("editing the clone leaves the source untouched", async () => {
    const sourceId = await seedRecipeWithContent();
    const pub = await publishRecipe({ recipeId: sourceId });
    if (!pub.ok) throw new Error("setup failed");

    const bobId = await seedExtraUser(state.db!, "bob");
    state.userId = bobId;

    const clone = await cloneRecipeFromSlug({ slug: pub.data.slug });
    if (!clone.ok) throw new Error("clone failed");

    // Rename the clone directly on the DB to simulate a Bob edit.
    await state
      .db!.update(recipes)
      .set({ name: "Bob's Custom Salamanders" })
      .where(eq(recipes.id, clone.data.id));

    const source = await state
      .db!.select()
      .from(recipes)
      .where(eq(recipes.id, sourceId));
    expect(source[0]?.name).toBe("Loaded Recipe");
  });
});
