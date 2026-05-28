import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { recipeSteps } from "@/db/schema";

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
const { addZone } = await import("@/lib/actions/recipeZones");
const { addStep, updateStep, deleteStep, reorderSteps } = await import(
  "@/lib/actions/recipeSteps"
);

const PAINT_A = "citadel-macragge-blue";
const PAINT_B = "vallejo-magic-blue";

async function seedZone(): Promise<string> {
  const recipe = await createRecipe({ name: "R", bodyType: "infantry" });
  if (!recipe.ok) throw new Error("recipe seed failed");
  const zone = await addZone({ recipeId: recipe.data.id, name: "Armor" });
  if (!zone.ok) throw new Error("zone seed failed");
  return zone.data.id;
}

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

describe("addStep", () => {
  test("adds a paint-backed step with the next position", async () => {
    const zoneId = await seedZone();
    await addStep({ zoneId, technique: "basecoat", paintId: PAINT_A });
    await addStep({ zoneId, technique: "wash", paintId: PAINT_B });

    const steps = await stepsFor(zoneId);
    expect(steps.map((s) => s.technique)).toEqual(["basecoat", "wash"]);
    expect(steps.map((s) => s.position)).toEqual([0, 1]);
    expect(steps[0]!.paintId).toBe(PAINT_A);
  });

  test("adds a custom-hex step (a mix)", async () => {
    const zoneId = await seedZone();
    const res = await addStep({
      zoneId,
      technique: "layer",
      customColorHex: "#5A9DD8",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.customColorHex).toBe("#5A9DD8");
    expect(res.data.paintId).toBeNull();
  });

  test("rejects a step with both a paint and a custom hex", async () => {
    const zoneId = await seedZone();
    const res = await addStep({
      zoneId,
      technique: "basecoat",
      paintId: PAINT_A,
      customColorHex: "#5A9DD8",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/exactly one/);
  });

  test("rejects a step with neither a paint nor a custom hex", async () => {
    const zoneId = await seedZone();
    const res = await addStep({ zoneId, technique: "basecoat" });
    expect(res.ok).toBe(false);
  });

  test("rejects a malformed hex", async () => {
    const zoneId = await seedZone();
    const res = await addStep({
      zoneId,
      technique: "layer",
      customColorHex: "not-a-hex",
    });
    expect(res.ok).toBe(false);
  });

  test("rejects a zone the user does not own", async () => {
    const zoneId = await seedZone();
    state.userId = "intruder";
    const res = await addStep({ zoneId, technique: "basecoat", paintId: PAINT_A });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Zone not found/);
  });
});

describe("updateStep", () => {
  test("changes the technique", async () => {
    const zoneId = await seedZone();
    const added = await addStep({ zoneId, technique: "basecoat", paintId: PAINT_A });
    if (!added.ok) throw new Error("setup");
    const res = await updateStep({ id: added.data.id, technique: "layer" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.technique).toBe("layer");
  });

  test("swapping to a custom hex clears the paint id", async () => {
    const zoneId = await seedZone();
    const added = await addStep({ zoneId, technique: "basecoat", paintId: PAINT_A });
    if (!added.ok) throw new Error("setup");
    const res = await updateStep({
      id: added.data.id,
      customColorHex: "#112233",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.customColorHex).toBe("#112233");
    expect(res.data.paintId).toBeNull();
  });

  test("rejects patching both paint and custom hex non-null at once", async () => {
    const zoneId = await seedZone();
    const added = await addStep({ zoneId, technique: "basecoat", paintId: PAINT_A });
    if (!added.ok) throw new Error("setup");
    const res = await updateStep({
      id: added.data.id,
      paintId: PAINT_B,
      customColorHex: "#112233",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/at most one/);
  });

  test("rejects clearing the paint without supplying a replacement colour", async () => {
    const zoneId = await seedZone();
    const added = await addStep({ zoneId, technique: "basecoat", paintId: PAINT_A });
    if (!added.ok) throw new Error("setup");
    const res = await updateStep({ id: added.data.id, paintId: null });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/exactly one/);
  });

  test("rejects an unknown step", async () => {
    const res = await updateStep({ id: "no-such-step", technique: "layer" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Step not found/);
  });
});

describe("deleteStep", () => {
  test("removes the step", async () => {
    const zoneId = await seedZone();
    const added = await addStep({ zoneId, technique: "basecoat", paintId: PAINT_A });
    if (!added.ok) throw new Error("setup");
    const res = await deleteStep({ id: added.data.id });
    expect(res.ok).toBe(true);
    expect(await stepsFor(zoneId)).toHaveLength(0);
  });
});

describe("reorderSteps", () => {
  test("rewrites positions to match the supplied order", async () => {
    const zoneId = await seedZone();
    const a = await addStep({ zoneId, technique: "basecoat", paintId: PAINT_A });
    const b = await addStep({ zoneId, technique: "wash", paintId: PAINT_B });
    const c = await addStep({ zoneId, technique: "layer", paintId: PAINT_A });
    if (!a.ok || !b.ok || !c.ok) throw new Error("setup");

    const res = await reorderSteps({
      zoneId,
      orderedIds: [c.data.id, b.data.id, a.data.id],
    });
    expect(res.ok).toBe(true);

    const steps = await stepsFor(zoneId);
    expect(steps.map((s) => s.technique)).toEqual(["layer", "wash", "basecoat"]);
  });

  test("rejects a mismatched ordering length", async () => {
    const zoneId = await seedZone();
    const a = await addStep({ zoneId, technique: "basecoat", paintId: PAINT_A });
    await addStep({ zoneId, technique: "wash", paintId: PAINT_B });
    if (!a.ok) throw new Error("setup");
    const res = await reorderSteps({ zoneId, orderedIds: [a.data.id] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/does not match/);
  });
});
