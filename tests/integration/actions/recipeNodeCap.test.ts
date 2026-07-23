import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { projects, recipes, users } from "@/db/schema";

/**
 * Gating-layer — recipes are UNLIMITED on every plan, including free
 * (docs/SUBSCRIPTION_PAYWALL.md fix 3: "unlimited free recipes, only the
 * creator's TOOLS are gated"). This suite used to prove a "1 recipe per
 * project node" free cap; that cap is now removed (`PLAN_LIMITS.free.recipes
 * = Infinity`) and this suite proves the removal empirically — many recipes
 * on the SAME node (standalone or attached to one project) all succeed for
 * a free user, not just theoretically via the constant.
 *
 * Enforcement is forced ON via the `@/lib/billing/plans` mock (mirrors the
 * pattern in proGates.test.ts / billingLimits.test.ts) so these assertions
 * don't depend on — or get silently invalidated by — BILLING_ENFORCED ever
 * moving again; `isWithinLimit` is repointed at the real, gate-independent
 * `isWithinPlanLimit` so the (now-Infinity) cap math actually runs.
 */

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

vi.mock("@/lib/billing/plans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/plans")>();
  return {
    ...actual,
    BILLING_ENFORCED: true,
    isWithinLimit: actual.isWithinPlanLimit,
  };
});

const { createRecipe } = await import("@/lib/actions/recipes");

async function setFree(): Promise<void> {
  await state.db!.update(users).set({ plan: "free" }).where(eq(users.id, state.userId));
}

async function seedProject(): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(projects).values({
    id,
    ownerId: state.userId,
    type: "Unit",
    name: `Node ${id}`,
    count: 1,
  });
  return id;
}

async function seedRecipeUnderNode(attachedProjectId: string | null): Promise<void> {
  await state.db!.insert(recipes).values({
    id: nanoid(16),
    ownerId: state.userId,
    name: `Seeded ${nanoid(6)}`,
    bodyType: "infantry",
    attachedProjectId,
    isStandalone: attachedProjectId === null,
  });
}

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
  await setFree();
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("recipes are unlimited on free — no per-node cap", () => {
  test("first recipe under a node is allowed", async () => {
    const projectId = await seedProject();
    const res = await createRecipe({
      name: "First on node",
      attachedProjectId: projectId,
    });
    expect(res.ok).toBe(true);
  });

  test("a SECOND recipe under the SAME project node is also allowed", async () => {
    const projectId = await seedProject();
    await seedRecipeUnderNode(projectId);
    const res = await createRecipe({
      name: "Second on node",
      attachedProjectId: projectId,
    });
    expect(res.ok).toBe(true);
    const rows = await state.db!.select().from(recipes);
    expect(rows).toHaveLength(2);
  });

  test("a THIRD, FOURTH, FIFTH recipe under the same node all succeed", async () => {
    const projectId = await seedProject();
    await seedRecipeUnderNode(projectId);
    await seedRecipeUnderNode(projectId);
    for (const name of ["Third", "Fourth", "Fifth"]) {
      const res = await createRecipe({ name, attachedProjectId: projectId });
      expect(res.ok).toBe(true);
    }
    const rows = await state.db!
      .select()
      .from(recipes)
      .where(eq(recipes.attachedProjectId, projectId));
    expect(rows).toHaveLength(5);
  });

  test("a second STANDALONE recipe (same null node) is also allowed", async () => {
    await seedRecipeUnderNode(null);
    const res = await createRecipe({ name: "Second standalone" });
    expect(res.ok).toBe(true);
  });

  test("a recipe on project A does not affect a recipe on project B", async () => {
    const projectA = await seedProject();
    const projectB = await seedProject();
    await seedRecipeUnderNode(projectA);
    const res = await createRecipe({
      name: "First on B",
      attachedProjectId: projectB,
    });
    expect(res.ok).toBe(true);
  });

  test("paid users are also unlimited (unchanged)", async () => {
    await state.db!
      .update(users)
      .set({ plan: "pro_lifetime" })
      .where(eq(users.id, state.userId));
    const projectId = await seedProject();
    await seedRecipeUnderNode(projectId);
    await seedRecipeUnderNode(projectId);
    const res = await createRecipe({
      name: "Third on node",
      attachedProjectId: projectId,
    });
    expect(res.ok).toBe(true);
  });
});
