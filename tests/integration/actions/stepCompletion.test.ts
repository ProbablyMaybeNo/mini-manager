/**
 * P15.0 / 2026-06-04 flatten — recipe slot-completion server actions +
 * query helper.
 *
 * Covers:
 *   1. setStepCompletion — inserts / deletes a recipe_step_completion
 *      row keyed by (user_id, slot_id); ownership-gated; idempotent.
 *      (slot_id == the old step_id, preserved by the migration; the
 *      `stepId` field name is kept on the action contract.)
 *   2. advanceSlot — completes a slot + resolves the next undone slot.
 *   3. getCompletedStepIds — reads the painter's done-set for a list of
 *      slot ids.
 *
 * Uses the in-memory libsql test DB so the migration exercises the
 * production path. Auth + revalidatePath are mocked. (The completion FK
 * re-point + cascade lives with Stage 4; the test DB runs FKs OFF by
 * default so slot-id completion rows insert cleanly here.)
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import {
  projects,
  recipes,
  recipeStepCompletion,
  recipeSlots,
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
 * Seed a project + attached recipe with `slotCount` flat slots. Returns
 * the slot ids in position order so tests can tick + assert
 * deterministically.
 */
async function seedRecipe(opts: {
  ownerId?: string;
  slotCount?: number;
} = {}) {
  const ownerId = opts.ownerId ?? state.userId;
  const slotCount = opts.slotCount ?? 4;

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

  // Stage 1 invariant: slot.id == the old step.id (preserved by the
  // migration). The completion FK still references recipe_step until
  // Stage 4 re-points it, so we seed a matching zone+step per slot with
  // the SAME id — exactly the production state a real recipe has after
  // the backfill. (The step seed is removed in Stage 4.)
  const zoneId = nanoid(16);
  await state.db!.insert(recipeZones).values({
    id: zoneId,
    recipeId,
    position: 0,
    name: "Zone",
  });

  const slots: string[] = [];
  for (let i = 0; i < slotCount; i++) {
    const id = nanoid(16);
    await state.db!.insert(recipeSteps).values({
      id,
      zoneId,
      position: i,
      technique: "basecoat",
      customColorHex: "#aabbcc",
    });
    await state.db!.insert(recipeSlots).values({
      id,
      recipeId,
      position: i,
      technique: "basecoat",
      customColorHex: "#aabbcc",
    });
    slots.push(id);
  }

  return { projectId, recipeId, slots };
}

async function isDone(userId: string, slotId: string): Promise<boolean> {
  const rows = await state
    .db!.select({ id: recipeStepCompletion.id })
    .from(recipeStepCompletion)
    .where(
      and(
        eq(recipeStepCompletion.userId, userId),
        eq(recipeStepCompletion.stepId, slotId),
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
  test("ticking a slot inserts a completion row", async () => {
    const { slots } = await seedRecipe();
    const slotId = slots[0]!;

    const res = await actions.setStepCompletion({ stepId: slotId, done: true });
    expect(res.ok).toBe(true);
    expect(await isDone(state.userId, slotId)).toBe(true);
  });

  test("un-ticking a slot deletes the completion row", async () => {
    const { slots } = await seedRecipe();
    const slotId = slots[0]!;
    await actions.setStepCompletion({ stepId: slotId, done: true });

    const res = await actions.setStepCompletion({ stepId: slotId, done: false });
    expect(res.ok).toBe(true);
    expect(await isDone(state.userId, slotId)).toBe(false);
  });

  test("ticking is idempotent — no duplicate rows", async () => {
    const { slots } = await seedRecipe();
    const slotId = slots[0]!;
    await actions.setStepCompletion({ stepId: slotId, done: true });
    await actions.setStepCompletion({ stepId: slotId, done: true });

    const rows = await state
      .db!.select()
      .from(recipeStepCompletion)
      .where(eq(recipeStepCompletion.stepId, slotId));
    expect(rows).toHaveLength(1);
  });

  test("done-state is per-painter — one painter ticking does not affect another", async () => {
    const { slots } = await seedRecipe();
    const slotId = slots[0]!;
    const other = await seedExtraUser(state.db!, "co-painter");

    await actions.setStepCompletion({ stepId: slotId, done: true });
    expect(await isDone(state.userId, slotId)).toBe(true);
    expect(await isDone(other, slotId)).toBe(false);
  });

  test("rejects a slot owned via another user's recipe", async () => {
    const otherId = await seedExtraUser(state.db!, "rival");
    const { slots } = await seedRecipe({ ownerId: otherId });
    const slotId = slots[0]!;

    const res = await actions.setStepCompletion({ stepId: slotId, done: true });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not found/i);
    expect(await isDone(state.userId, slotId)).toBe(false);
  });

  test("rejects an unknown slot id", async () => {
    const res = await actions.setStepCompletion({
      stepId: "nope",
      done: true,
    });
    expect(res.ok).toBe(false);
  });
});

describe("advanceSlot — complete + advance to next undone slot", () => {
  test("marks the slot done", async () => {
    const { slots } = await seedRecipe({ slotCount: 3 });
    const res = await actions.advanceSlot({ zoneId: slots[0]! });
    expect(res.ok).toBe(true);
    expect(await isDone(state.userId, slots[0]!)).toBe(true);
  });

  test("returns the next undone slot", async () => {
    const { slots } = await seedRecipe({ slotCount: 3 });
    const res = await actions.advanceSlot({ zoneId: slots[0]! });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.nextSlotId).toBe(slots[1]!);
  });

  test("skips already-complete slots when finding the next slot", async () => {
    const { slots } = await seedRecipe({ slotCount: 3 });
    // Pre-complete the middle slot.
    await actions.setStepCompletion({ stepId: slots[1]!, done: true });

    const res = await actions.advanceSlot({ zoneId: slots[0]! });
    expect(res.ok).toBe(true);
    // slots[1] is already done → next undone is slots[2].
    if (res.ok) expect(res.data.nextSlotId).toBe(slots[2]!);
  });

  test("returns null next slot when the whole recipe is now complete", async () => {
    const { slots } = await seedRecipe({ slotCount: 1 });
    const res = await actions.advanceSlot({ zoneId: slots[0]! });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.nextSlotId).toBeNull();
  });

  test("does not duplicate completion rows for an already-done slot", async () => {
    const { slots } = await seedRecipe({ slotCount: 2 });
    await actions.setStepCompletion({ stepId: slots[0]!, done: true });

    const res = await actions.advanceSlot({ zoneId: slots[0]! });
    expect(res.ok).toBe(true);

    const rows = await state.db!.select().from(recipeStepCompletion);
    expect(rows).toHaveLength(1); // not 2
  });

  test("rejects a slot owned via another user's recipe", async () => {
    const otherId = await seedExtraUser(state.db!, "rival");
    const { slots } = await seedRecipe({ ownerId: otherId });
    const res = await actions.advanceSlot({ zoneId: slots[0]! });
    expect(res.ok).toBe(false);
  });
});

describe("getCompletedStepIds — read the painter's done-set", () => {
  test("returns only the painter's completed slot ids within the list", async () => {
    const { slots } = await seedRecipe({ slotCount: 3 });
    const [a, b, c] = slots as [string, string, string];
    await actions.setStepCompletion({ stepId: a, done: true });
    await actions.setStepCompletion({ stepId: c, done: true });

    const done = await queries.getCompletedStepIds(state.userId, [a, b, c]);
    expect(done.has(a)).toBe(true);
    expect(done.has(b)).toBe(false);
    expect(done.has(c)).toBe(true);
  });

  test("empty slot-id list short-circuits to an empty set", async () => {
    const done = await queries.getCompletedStepIds(state.userId, []);
    expect(done.size).toBe(0);
  });

  test("user-scoped — one painter's mark is invisible to another", async () => {
    const { slots } = await seedRecipe({ slotCount: 1 });
    const slotId = slots[0]!;
    const mine = state.userId;
    const other = await seedExtraUser(state.db!, "co-painter");

    await state.db!
      .insert(recipeStepCompletion)
      .values({ userId: other, stepId: slotId });

    const otherDone = await queries.getCompletedStepIds(other, [slotId]);
    expect(otherDone.has(slotId)).toBe(true);

    const myDone = await queries.getCompletedStepIds(mine, [slotId]);
    expect(myDone.has(slotId)).toBe(false);
  });
});
