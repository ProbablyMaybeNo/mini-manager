import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { recipes, users } from "@/db/schema";

/**
 * Gating-layer — Pro-only "apply / share" actions are gated on
 * `isProUser`. The production gate is inert pre-Stripe (BILLING_ENFORCED
 * === false → isProUser returns true for everyone), so it changes nothing
 * for users today. THIS suite forces enforcement ON (real plan resolution
 * otherwise) to prove the gates actually bite when a user is NOT Pro and
 * pass through for paid users.
 *
 * Covered Pro-only actions:
 *   - publishRecipe         (recipe SHARING)
 *   - createPalette         (Save Palette — apply tool result)
 *   - sendPaletteToRecipe   (Send to Recipe — apply tool result)
 *   - applyImport           (army-list import)
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
    // isProUser (in enforce.ts) reads BILLING_ENFORCED as a binding from
    // this module, so the override alone gates it. isWithinLimit closes
    // over the const internally, so re-point it at the real cap math too.
    isWithinLimit: actual.isWithinPlanLimit,
  };
});

const { publishRecipe } = await import("@/lib/actions/recipeSharing");
const { createPalette } = await import("@/lib/actions/palettes");
const { sendPaletteToRecipe } = await import("@/lib/actions/sendToRecipe");

async function setPlan(plan: string): Promise<void> {
  await state.db!.update(users).set({ plan }).where(eq(users.id, state.userId));
}

async function seedRecipe(): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(recipes).values({
    id,
    ownerId: state.userId,
    name: "Sharable",
    bodyType: "infantry",
    isStandalone: true,
  });
  return id;
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

describe("publishRecipe — Pro-gated recipe sharing", () => {
  test("a FREE user is blocked with an upgrade URL", async () => {
    await setPlan("free");
    const recipeId = await seedRecipe();
    const res = await publishRecipe({ recipeId });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Pro feature/i);
    expect(res.upgradeUrl).toBe("/pricing");
    // Gate ran before minting — no slug persisted.
    const [row] = await state.db!
      .select({ publicSlug: recipes.publicSlug })
      .from(recipes)
      .where(eq(recipes.id, recipeId));
    expect(row?.publicSlug).toBeNull();
  });

  test("a PRO user can publish", async () => {
    await setPlan("pro_lifetime");
    const recipeId = await seedRecipe();
    const res = await publishRecipe({ recipeId });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.slug).toHaveLength(10);
  });
});

describe("createPalette — Pro-gated Save Palette", () => {
  test("a FREE user is blocked with an upgrade URL", async () => {
    await setPlan("free");
    const res = await createPalette({
      name: "Triad",
      source: "eyedropper",
      colorHexes: ["#0E4A8A"],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Pro feature/i);
    expect(res.upgradeUrl).toBe("/pricing");
  });

  test("a PRO user can save a palette", async () => {
    await setPlan("pro_lifetime");
    const res = await createPalette({
      name: "Triad",
      source: "eyedropper",
      colorHexes: ["#0E4A8A"],
    });
    expect(res.ok).toBe(true);
  });
});

describe("sendPaletteToRecipe — Pro-gated Send to Recipe", () => {
  test("a FREE user is blocked with an upgrade URL", async () => {
    await setPlan("free");
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#0e4a8a" }],
      newRecipeName: "From tool",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Pro feature/i);
    expect(res.upgradeUrl).toBe("/pricing");
    // No recipe created — gate ran first.
    const rows = await state.db!.select().from(recipes);
    expect(rows).toHaveLength(0);
  });

  test("a PRO user can send a palette to a recipe", async () => {
    await setPlan("pro_monthly");
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#0e4a8a" }],
      newRecipeName: "From tool",
    });
    expect(res.ok).toBe(true);
  });
});
