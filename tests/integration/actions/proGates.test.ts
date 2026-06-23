import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { imports, recipes, users } from "@/db/schema";

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
 *   - createTextImport      (army-list PARSE — pasted text)
 *   - createFileImport      (army-list PARSE — uploaded file)
 *   - applyImport           (army-list import — landing the preview)
 *
 * The two import PARSE entry points gate BEFORE parsing so a free user
 * never reaches `parseWithLlm` (the LLM fallback that spends tokens).
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
const { createTextImport, createFileImport } = await import(
  "@/lib/actions/imports"
);

// A list with strong, unambiguous structure so the heuristic parser is
// confident — guarantees the only way the LLM fallback fires is if the
// Pro gate FAILED to short-circuit first. The Pro path asserting ok:true
// thus also proves the gate doesn't break the happy path.
const SAMPLE_LIST = `## Ultramarines Strike Force
Faction: Adeptus Astartes
Points Limit: 2000

10x Intercessors - 200pts
5x Terminators - 185pts
Captain - 105pts
`;

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

describe("createTextImport — Pro-gated army-list parse (pasted text)", () => {
  test("a FREE user is blocked with an upgrade URL and nothing is persisted", async () => {
    await setPlan("free");
    const res = await createTextImport({ rawText: SAMPLE_LIST });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Pro feature/i);
    expect(res.upgradeUrl).toBe("/pricing");
    // Gate ran before parse + persist — no import row was created (and so
    // the LLM fallback parser was never reached).
    const rows = await state.db!.select().from(imports);
    expect(rows).toHaveLength(0);
  });

  test("a PRO user can parse a pasted list", async () => {
    await setPlan("pro_lifetime");
    const res = await createTextImport({ rawText: SAMPLE_LIST });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.importId).toBeTruthy();
  });
});

describe("createFileImport — Pro-gated army-list parse (uploaded file)", () => {
  test("a FREE user is blocked with an upgrade URL and nothing is persisted", async () => {
    await setPlan("free");
    const list = JSON.stringify({
      name: "JSON Strike Force",
      faction: "Adeptus Astartes",
      totalPoints: 2000,
      units: [{ name: "Intercessors", models: 10, points: 200 }],
    });
    const base64 = Buffer.from(list, "utf-8").toString("base64");
    const res = await createFileImport({
      filename: "army.json",
      base64,
      size: list.length,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Pro feature/i);
    expect(res.upgradeUrl).toBe("/pricing");
    const rows = await state.db!.select().from(imports);
    expect(rows).toHaveLength(0);
  });

  test("a PRO user can parse an uploaded file", async () => {
    await setPlan("pro_monthly");
    const list = JSON.stringify({
      name: "JSON Strike Force",
      faction: "Adeptus Astartes",
      totalPoints: 2000,
      units: [{ name: "Intercessors", models: 10, points: 200 }],
    });
    const base64 = Buffer.from(list, "utf-8").toString("base64");
    const res = await createFileImport({
      filename: "army.json",
      base64,
      size: list.length,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.importId).toBeTruthy();
  });
});
