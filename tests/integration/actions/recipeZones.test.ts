import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { recipeZones } from "@/db/schema";

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
const { addZone, updateZone, deleteZone, reorderZones } = await import(
  "@/lib/actions/recipeZones"
);

async function seedRecipe(): Promise<string> {
  const res = await createRecipe({ name: "Test Recipe", bodyType: "infantry" });
  if (!res.ok) throw new Error("recipe seed failed");
  return res.data.id;
}

async function zonesFor(recipeId: string) {
  return state.db!
    .select()
    .from(recipeZones)
    .where(eq(recipeZones.recipeId, recipeId))
    .orderBy(asc(recipeZones.position));
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

describe("addZone", () => {
  test("appends zones with incrementing positions", async () => {
    const recipeId = await seedRecipe();
    await addZone({ recipeId, name: "Armor" });
    await addZone({ recipeId, name: "Trim" });
    await addZone({ recipeId, name: "Base" });

    const zones = await zonesFor(recipeId);
    expect(zones.map((z) => z.name)).toEqual(["Armor", "Trim", "Base"]);
    expect(zones.map((z) => z.position)).toEqual([0, 1, 2]);
  });

  test("trims and stores the silhouette zone id", async () => {
    const recipeId = await seedRecipe();
    const res = await addZone({
      recipeId,
      name: "  Helmet  ",
      silhouetteZoneId: "head",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.name).toBe("Helmet");
    expect(res.data.silhouetteZoneId).toBe("head");
  });

  test("rejects an empty name", async () => {
    const recipeId = await seedRecipe();
    const res = await addZone({ recipeId, name: "   " });
    expect(res.ok).toBe(false);
  });

  test("rejects a recipe the user does not own", async () => {
    const recipeId = await seedRecipe();
    state.userId = "intruder";
    const res = await addZone({ recipeId, name: "Hostile" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Recipe not found/);
  });
});

describe("updateZone", () => {
  test("renames a zone", async () => {
    const recipeId = await seedRecipe();
    const added = await addZone({ recipeId, name: "Armor" });
    if (!added.ok) throw new Error("setup");
    const res = await updateZone({ id: added.data.id, name: "Power Armor" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.name).toBe("Power Armor");
  });

  test("clears the silhouette link when set to null", async () => {
    const recipeId = await seedRecipe();
    const added = await addZone({
      recipeId,
      name: "Cloak",
      silhouetteZoneId: "cloak",
    });
    if (!added.ok) throw new Error("setup");
    const res = await updateZone({ id: added.data.id, silhouetteZoneId: null });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.silhouetteZoneId).toBeNull();
  });

  test("rejects an unknown zone", async () => {
    const res = await updateZone({ id: "no-such-zone", name: "X" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Zone not found/);
  });
});

describe("deleteZone", () => {
  test("removes the zone", async () => {
    const recipeId = await seedRecipe();
    const added = await addZone({ recipeId, name: "Doomed" });
    if (!added.ok) throw new Error("setup");
    const res = await deleteZone({ id: added.data.id });
    expect(res.ok).toBe(true);
    expect(await zonesFor(recipeId)).toHaveLength(0);
  });

  test("cannot delete a zone in another user's recipe", async () => {
    const recipeId = await seedRecipe();
    const added = await addZone({ recipeId, name: "Mine" });
    if (!added.ok) throw new Error("setup");
    state.userId = "intruder";
    const res = await deleteZone({ id: added.data.id });
    expect(res.ok).toBe(false);
    // zonesFor queries by recipeId directly, so the row should still be there.
    expect(await zonesFor(recipeId)).toHaveLength(1);
  });
});

describe("reorderZones", () => {
  test("rewrites positions to match the supplied order", async () => {
    const recipeId = await seedRecipe();
    const a = await addZone({ recipeId, name: "A" });
    const b = await addZone({ recipeId, name: "B" });
    const c = await addZone({ recipeId, name: "C" });
    if (!a.ok || !b.ok || !c.ok) throw new Error("setup");

    const res = await reorderZones({
      recipeId,
      orderedIds: [c.data.id, a.data.id, b.data.id],
    });
    expect(res.ok).toBe(true);

    const zones = await zonesFor(recipeId);
    expect(zones.map((z) => z.name)).toEqual(["C", "A", "B"]);
  });

  test("rejects a list whose length mismatches the zone count", async () => {
    const recipeId = await seedRecipe();
    const a = await addZone({ recipeId, name: "A" });
    await addZone({ recipeId, name: "B" });
    if (!a.ok) throw new Error("setup");
    const res = await reorderZones({ recipeId, orderedIds: [a.data.id] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/does not match/);
  });

  test("rejects an unknown id in the ordering", async () => {
    const recipeId = await seedRecipe();
    const a = await addZone({ recipeId, name: "A" });
    const b = await addZone({ recipeId, name: "B" });
    if (!a.ok || !b.ok) throw new Error("setup");
    const res = await reorderZones({
      recipeId,
      orderedIds: [a.data.id, "ghost-id"],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Unknown zone id/);
  });
});
