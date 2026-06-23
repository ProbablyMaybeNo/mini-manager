import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { projects, recipes, users } from "@/db/schema";

/**
 * Gating-layer — the FREE recipe cap is PER PROJECT NODE (1 recipe per
 * `attachedProjectId`; standalone recipes share the null node), NOT a
 * per-account total. The production runtime gate is inert pre-Stripe
 * (BILLING_ENFORCED === false), so the enforcement assertions in
 * billingLimits.test.ts are skipped today. To keep the per-node MATH +
 * the action-layer counting under live coverage right now, THIS suite
 * mocks `BILLING_ENFORCED` to `true` (everything else in plans.ts stays
 * real) so the gate actually bites and we can prove:
 *
 *   - a 2nd recipe under the SAME node is blocked,
 *   - a recipe on project A does NOT block a first recipe on project B,
 *   - a recipe on a project does NOT block a first standalone recipe.
 *
 * The "block on same node" property + the "different node is free"
 * property together are exactly what separates a per-node cap from a
 * per-account total.
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

// Force enforcement ON for this suite only — keep the real cap math.
// `isWithinLimit` closes over the module-internal BILLING_ENFORCED const,
// so overriding the export alone wouldn't make it bite; point it at the
// real, gate-independent `isWithinPlanLimit` so the per-node MATH runs.
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

describe("per-node recipe cap (enforcement forced ON)", () => {
  test("first recipe under a node is allowed", async () => {
    const projectId = await seedProject();
    const res = await createRecipe({
      name: "First on node",
      attachedProjectId: projectId,
    });
    expect(res.ok).toBe(true);
  });

  test("second recipe UNDER THE SAME PROJECT is blocked + upgrade URL", async () => {
    const projectId = await seedProject();
    await seedRecipeUnderNode(projectId);
    const res = await createRecipe({
      name: "Second on node",
      attachedProjectId: projectId,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Free tier limit reached/);
    expect(res.upgradeUrl).toBe("/pricing");
    // Gate ran before the insert — only the seeded row exists.
    const rows = await state.db!.select().from(recipes);
    expect(rows).toHaveLength(1);
  });

  test("second STANDALONE recipe (same null node) is blocked", async () => {
    await seedRecipeUnderNode(null);
    const res = await createRecipe({ name: "Second standalone" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Free tier limit reached/);
    expect(res.upgradeUrl).toBe("/pricing");
  });

  test("a recipe on project A does NOT block a first recipe on project B", async () => {
    const projectA = await seedProject();
    const projectB = await seedProject();
    await seedRecipeUnderNode(projectA);
    const res = await createRecipe({
      name: "First on B",
      attachedProjectId: projectB,
    });
    expect(res.ok).toBe(true);
  });

  test("a recipe on a project does NOT block a first standalone recipe", async () => {
    const projectId = await seedProject();
    await seedRecipeUnderNode(projectId);
    const res = await createRecipe({ name: "First standalone" });
    expect(res.ok).toBe(true);
  });

  test("a standalone recipe does NOT block a first recipe on a project", async () => {
    await seedRecipeUnderNode(null);
    const projectId = await seedProject();
    const res = await createRecipe({
      name: "First on project",
      attachedProjectId: projectId,
    });
    expect(res.ok).toBe(true);
  });

  test("paid users are NOT capped per node", async () => {
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
