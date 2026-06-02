/**
 * P15.0 — Recipe step-completion server actions + query helper.
 *
 * Covers:
 *   1. setStepCompletion — inserts / deletes a recipe_step_completion
 *      row keyed by (user_id, step_id); ownership-gated; idempotent.
 *   2. advanceSlot — bulk-completes a slot's steps + resolves the next
 *      slot with outstanding work.
 *   3. getCompletedStepIds — reads the painter's done-set for a list of
 *      step ids.
 *
 * Uses the in-memory libsql test DB so the new migration + FK cascade
 * exercise the production path. Auth + revalidatePath are mocked.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import {
  projects,
  recipes,
  recipeStepCompletion,
  recipeSteps,
  recipeZones,
} from "@/db/schema";

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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const actions = await import("@/lib/actions/stepCompletion");
const queries = await import("@/db/queries/stepCompletion");

/**
 * Seed a project + attached recipe with `zoneCount` zones, each holding
 * `stepsPerZone` steps. Returns the ids in slot/step order so tests can
 * tick + assert deterministically.
 */
async function seedRecipe(opts: {
  ownerId?: string;
  zoneCount?: number;
  stepsPerZone?: number;
} = {}) {
  const ownerId = opts.ownerId ?? state.userId;
  const zoneCount = opts.zoneCount ?? 2;
  const stepsPerZone = opts.stepsPerZone ?? 2;

  const projectId = nanoid(16);
  await state.db!.insert(projects).values({
    id: projectId,
    ownerId,
    type: "Unit",
    name: "Test Squad",
    count: 5,
  });

  const recipeId = nanoid(16);
  await state.db!.insert(recipes).values({
    id: recipeId,
    ownerId,
    name: "Test Scheme",
    attachedProjectId: projectId,
    bodyType: "infantry",
  });

  const zones: { id: string; steps: string[] }[] = [];
  for (let z = 0; z < zoneCount; z++) {
    const zoneId = nanoid(16);
    await state.db!.insert(recipeZones).values({
      id: zoneId,
      recipeId,
      position: z,
      name: `Zone ${z}`,
    });
    const steps: string[] = [];
    for (let s = 0; s < stepsPerZone; s++) {
      const stepId = nanoid(16);
      await state.db!.insert(recipeSteps).values({
        id: stepId,
        zoneId,
        position: s,
        technique: "basecoat",
        customColorHex: "#aabbcc",
      });
      steps.push(stepId);
    }
    zones.push({ id: zoneId, steps });
  }

  return { projectId, recipeId, zones };
}

async function isDone(userId: string, stepId: string): Promise<boolean> {
  const rows = await state
    .db!.select({ id: recipeStepCompletion.id })
    .from(recipeStepCompletion)
    .where(
      and(
        eq(recipeStepCompletion.userId, userId),
        eq(recipeStepCompletion.stepId, stepId),
      ),
    );
  return rows.length > 0;
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

describe("setStepCompletion — per-painter done toggle", () => {
  test("ticking a step inserts a completion row", async () => {
    const { zones } = await seedRecipe();
    const stepId = zones[0]!.steps[0]!;

    const res = await actions.setStepCompletion({ stepId, done: true });
    expect(res.ok).toBe(true);
    expect(await isDone(state.userId, stepId)).toBe(true);
  });

  test("un-ticking a step deletes the completion row", async () => {
    const { zones } = await seedRecipe();
    const stepId = zones[0]!.steps[0]!;
    await actions.setStepCompletion({ stepId, done: true });

    const res = await actions.setStepCompletion({ stepId, done: false });
    expect(res.ok).toBe(true);
    expect(await isDone(state.userId, stepId)).toBe(false);
  });

  test("ticking is idempotent — no duplicate rows", async () => {
    const { zones } = await seedRecipe();
    const stepId = zones[0]!.steps[0]!;
    await actions.setStepCompletion({ stepId, done: true });
    await actions.setStepCompletion({ stepId, done: true });

    const rows = await state
      .db!.select()
      .from(recipeStepCompletion)
      .where(eq(recipeStepCompletion.stepId, stepId));
    expect(rows).toHaveLength(1);
  });

  test("done-state is per-painter — one painter ticking does not affect another", async () => {
    const { zones } = await seedRecipe();
    const stepId = zones[0]!.steps[0]!;
    const other = await seedExtraUser(state.db!, "co-painter");

    await actions.setStepCompletion({ stepId, done: true });
    expect(await isDone(state.userId, stepId)).toBe(true);
    expect(await isDone(other, stepId)).toBe(false);
  });

  test("rejects a step owned via another user's recipe", async () => {
    const otherId = await seedExtraUser(state.db!, "rival");
    const { zones } = await seedRecipe({ ownerId: otherId });
    const stepId = zones[0]!.steps[0]!;

    const res = await actions.setStepCompletion({ stepId, done: true });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not found/i);
    expect(await isDone(state.userId, stepId)).toBe(false);
  });

  test("rejects an unknown step id", async () => {
    const res = await actions.setStepCompletion({
      stepId: "nope",
      done: true,
    });
    expect(res.ok).toBe(false);
  });

  test("FK cascade — deleting the step removes its completion mark", async () => {
    const { zones } = await seedRecipe();
    const stepId = zones[0]!.steps[0]!;
    await actions.setStepCompletion({ stepId, done: true });

    await state.db!.run("PRAGMA foreign_keys = ON");
    await state.db!.delete(recipeSteps).where(eq(recipeSteps.id, stepId));

    const rows = await state
      .db!.select()
      .from(recipeStepCompletion)
      .where(eq(recipeStepCompletion.stepId, stepId));
    expect(rows).toHaveLength(0);
  });
});

describe("advanceSlot — bulk-complete + advance to next undone slot", () => {
  test("marks every step in the slot done", async () => {
    const { zones } = await seedRecipe({ zoneCount: 2, stepsPerZone: 3 });
    const res = await actions.advanceSlot({ zoneId: zones[0]!.id });
    expect(res.ok).toBe(true);

    for (const stepId of zones[0]!.steps) {
      expect(await isDone(state.userId, stepId)).toBe(true);
    }
  });

  test("returns the next slot with an undone step", async () => {
    const { zones } = await seedRecipe({ zoneCount: 3, stepsPerZone: 1 });
    const res = await actions.advanceSlot({ zoneId: zones[0]!.id });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.nextSlotId).toBe(zones[1]!.id);
  });

  test("skips already-complete slots when finding the next slot", async () => {
    const { zones } = await seedRecipe({ zoneCount: 3, stepsPerZone: 1 });
    // Pre-complete the middle slot.
    await actions.setStepCompletion({ stepId: zones[1]!.steps[0]!, done: true });

    const res = await actions.advanceSlot({ zoneId: zones[0]!.id });
    expect(res.ok).toBe(true);
    // z1 is fully done already → next undone is z2.
    if (res.ok) expect(res.data.nextSlotId).toBe(zones[2]!.id);
  });

  test("returns null next slot when the whole recipe is now complete", async () => {
    const { zones } = await seedRecipe({ zoneCount: 1, stepsPerZone: 2 });
    const res = await actions.advanceSlot({ zoneId: zones[0]!.id });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.nextSlotId).toBeNull();
  });

  test("does not duplicate completion rows for already-done steps", async () => {
    const { zones } = await seedRecipe({ zoneCount: 1, stepsPerZone: 2 });
    await actions.setStepCompletion({ stepId: zones[0]!.steps[0]!, done: true });

    const res = await actions.advanceSlot({ zoneId: zones[0]!.id });
    expect(res.ok).toBe(true);

    const rows = await state.db!.select().from(recipeStepCompletion);
    expect(rows).toHaveLength(2); // not 3
  });

  test("rejects a slot owned via another user's recipe", async () => {
    const otherId = await seedExtraUser(state.db!, "rival");
    const { zones } = await seedRecipe({ ownerId: otherId });
    const res = await actions.advanceSlot({ zoneId: zones[0]!.id });
    expect(res.ok).toBe(false);
  });
});

describe("getCompletedStepIds — read the painter's done-set", () => {
  test("returns only the painter's completed step ids within the list", async () => {
    const { zones } = await seedRecipe({ zoneCount: 1, stepsPerZone: 3 });
    const [a, b, c] = zones[0]!.steps as [string, string, string];
    await actions.setStepCompletion({ stepId: a, done: true });
    await actions.setStepCompletion({ stepId: c, done: true });

    const done = await queries.getCompletedStepIds(state.userId, [a, b, c]);
    expect(done.has(a)).toBe(true);
    expect(done.has(b)).toBe(false);
    expect(done.has(c)).toBe(true);
  });

  test("empty step-id list short-circuits to an empty set", async () => {
    const done = await queries.getCompletedStepIds(state.userId, []);
    expect(done.size).toBe(0);
  });

  test("user-scoped — one painter's mark is invisible to another", async () => {
    // The completion table is keyed (user_id, step_id). Two painters can
    // each hold their own mark on the same step. Seed both rows directly
    // (the toggle action is owner-gated, which is orthogonal to the
    // query's user-scoping — that's what's under test here).
    const { zones } = await seedRecipe({ zoneCount: 1, stepsPerZone: 1 });
    const stepId = zones[0]!.steps[0]!;
    const mine = state.userId;
    const other = await seedExtraUser(state.db!, "co-painter");

    await state.db!
      .insert(recipeStepCompletion)
      .values({ userId: other, stepId });

    // The OTHER painter's row exists for them…
    const otherDone = await queries.getCompletedStepIds(other, [stepId]);
    expect(otherDone.has(stepId)).toBe(true);

    // …but the original painter's done-set is empty.
    const myDone = await queries.getCompletedStepIds(mine, [stepId]);
    expect(myDone.has(stepId)).toBe(false);
  });
});
