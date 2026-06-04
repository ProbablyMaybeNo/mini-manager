/**
 * Unified recipe-slot actions (2026-06-04 flatten) — a recipe is now a
 * flat ordered list of slots, each = one paint (paintId | customColorHex)
 * + its layer (technique). Mirrors recipeZones/recipeSteps coverage:
 * append-with-position, the exactly-one paint/hex invariant, ownership
 * scoping, and the offset-safe reorder. Runs against a real in-memory
 * libsql DB with all migrations applied (so recipe_slot exists).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { recipeSlots } from "@/db/schema";

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
const { addSlot, updateSlot, deleteSlot, reorderSlots } = await import(
  "@/lib/actions/recipeSlots"
);
const { getRecipeWithSlots } = await import("@/db/queries/recipes");

async function seedRecipe(): Promise<string> {
  const res = await createRecipe({ name: "Test Recipe", bodyType: "infantry" });
  if (!res.ok) throw new Error("recipe seed failed");
  return res.data.id;
}

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

describe("addSlot", () => {
  test("appends slots with incrementing positions; default technique basecoat", async () => {
    const recipeId = await seedRecipe();
    await addSlot({ recipeId, paintId: "p1" });
    await addSlot({ recipeId, paintId: "p2", technique: "wash" });
    await addSlot({ recipeId, customColorHex: "#FF8800" });

    const slots = await slotsFor(recipeId);
    expect(slots.map((s) => s.position)).toEqual([0, 1, 2]);
    expect(slots.map((s) => s.technique)).toEqual(["basecoat", "wash", "basecoat"]);
    expect(slots.map((s) => s.paintId)).toEqual(["p1", "p2", null]);
    expect(slots[2]?.customColorHex).toBe("#FF8800");
  });

  test("rejects when neither paint nor hex is set", async () => {
    const recipeId = await seedRecipe();
    const res = await addSlot({ recipeId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/exactly one/);
  });

  test("rejects when both paint and hex are set", async () => {
    const recipeId = await seedRecipe();
    const res = await addSlot({ recipeId, paintId: "p1", customColorHex: "#FF0000" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/exactly one/);
  });

  test("rejects malformed hex", async () => {
    const recipeId = await seedRecipe();
    const res = await addSlot({ recipeId, customColorHex: "not-a-hex" });
    expect(res.ok).toBe(false);
  });

  test("rejects a recipe the user does not own", async () => {
    const recipeId = await seedRecipe();
    state.userId = "intruder";
    const res = await addSlot({ recipeId, paintId: "p1" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Recipe not found/);
  });
});

describe("updateSlot", () => {
  test("changes technique and notes", async () => {
    const recipeId = await seedRecipe();
    const added = await addSlot({ recipeId, paintId: "p1" });
    if (!added.ok) throw new Error("setup");
    const res = await updateSlot({
      id: added.data.id,
      technique: "highlight",
      notes: "edge only",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.technique).toBe("highlight");
    expect(res.data.notes).toBe("edge only");
  });

  test("switching to a custom hex clears the paintId (invariant holds)", async () => {
    const recipeId = await seedRecipe();
    const added = await addSlot({ recipeId, paintId: "p1" });
    if (!added.ok) throw new Error("setup");
    const res = await updateSlot({ id: added.data.id, customColorHex: "#123456" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.customColorHex).toBe("#123456");
    expect(res.data.paintId).toBeNull();
  });

  test("rejects setting both paint and hex at once", async () => {
    const recipeId = await seedRecipe();
    const added = await addSlot({ recipeId, paintId: "p1" });
    if (!added.ok) throw new Error("setup");
    const res = await updateSlot({
      id: added.data.id,
      paintId: "p2",
      customColorHex: "#abcdef",
    });
    expect(res.ok).toBe(false);
  });

  test("rejects an unknown slot", async () => {
    const res = await updateSlot({ id: "no-such-slot", technique: "wash" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Slot not found/);
  });
});

describe("deleteSlot", () => {
  test("removes the slot", async () => {
    const recipeId = await seedRecipe();
    const added = await addSlot({ recipeId, paintId: "doomed" });
    if (!added.ok) throw new Error("setup");
    const res = await deleteSlot({ id: added.data.id });
    expect(res.ok).toBe(true);
    expect(await slotsFor(recipeId)).toHaveLength(0);
  });

  test("cannot delete a slot in another user's recipe", async () => {
    const recipeId = await seedRecipe();
    const added = await addSlot({ recipeId, paintId: "mine" });
    if (!added.ok) throw new Error("setup");
    state.userId = "intruder";
    const res = await deleteSlot({ id: added.data.id });
    expect(res.ok).toBe(false);
    expect(await slotsFor(recipeId)).toHaveLength(1);
  });
});

describe("reorderSlots", () => {
  test("rewrites positions to match the supplied order", async () => {
    const recipeId = await seedRecipe();
    const a = await addSlot({ recipeId, paintId: "A" });
    const b = await addSlot({ recipeId, paintId: "B" });
    const c = await addSlot({ recipeId, paintId: "C" });
    if (!a.ok || !b.ok || !c.ok) throw new Error("setup");

    const res = await reorderSlots({
      recipeId,
      orderedIds: [c.data.id, a.data.id, b.data.id],
    });
    expect(res.ok).toBe(true);

    const slots = await slotsFor(recipeId);
    expect(slots.map((s) => s.paintId)).toEqual(["C", "A", "B"]);
    expect(slots.map((s) => s.position)).toEqual([0, 1, 2]);
  });

  test("rejects a length mismatch", async () => {
    const recipeId = await seedRecipe();
    const a = await addSlot({ recipeId, paintId: "A" });
    await addSlot({ recipeId, paintId: "B" });
    if (!a.ok) throw new Error("setup");
    const res = await reorderSlots({ recipeId, orderedIds: [a.data.id] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/does not match/);
  });

  test("rejects an unknown id in the ordering", async () => {
    const recipeId = await seedRecipe();
    const a = await addSlot({ recipeId, paintId: "A" });
    const b = await addSlot({ recipeId, paintId: "B" });
    if (!a.ok || !b.ok) throw new Error("setup");
    const res = await reorderSlots({
      recipeId,
      orderedIds: [a.data.id, "ghost-id"],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Unknown slot id/);
  });
});

describe("getRecipeWithSlots", () => {
  test("returns the recipe with its slots in position order", async () => {
    const recipeId = await seedRecipe();
    await addSlot({ recipeId, paintId: "p1", technique: "basecoat" });
    await addSlot({ recipeId, paintId: "p2", technique: "wash" });

    const full = await getRecipeWithSlots(state.userId, recipeId);
    expect(full).not.toBeNull();
    expect(full!.slots.map((s) => s.paintId)).toEqual(["p1", "p2"]);
  });

  test("returns null for another user's recipe", async () => {
    const recipeId = await seedRecipe();
    const full = await getRecipeWithSlots("intruder", recipeId);
    expect(full).toBeNull();
  });
});
