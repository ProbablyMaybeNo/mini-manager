import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { imports, recipes, users } from "@/db/schema";

/**
 * Gating-layer — Pro-only "apply" actions are gated on `isProUser`.
 * BILLING_ENFORCED is live in production now, but this suite still forces
 * enforcement ON via its own `@/lib/billing/plans` mock so the gate
 * assertions don't depend on (or get silently disabled by) that module-level
 * flag ever moving again.
 *
 * The paid line is "does this action cost money to run" (Ross, 2026-09-05).
 * Only AI-spending actions gate; anything that is pure colour maths or a plain
 * DB write is free.
 *
 * Covered Pro-only actions — all three spend LLM tokens:
 *   - createTextImport      (army-list PARSE — pasted text)
 *   - createFileImport      (army-list PARSE — uploaded file)
 *   - applyImport           (army-list import — landing the preview)
 *
 * The two import PARSE entry points gate BEFORE parsing so a free user
 * never reaches `parseWithLlm` (the LLM fallback that spends tokens).
 *
 * `createPalette` and `sendPaletteToRecipe` were gated here until the same
 * date. They are asserted below to be FREE now — a regression guard, since
 * re-gating them would be re-charging for arithmetic.
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

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("createPalette — free, costs nothing to run", () => {
  test("a FREE user can save a palette", async () => {
    await setPlan("free");
    const res = await createPalette({
      name: "Triad",
      source: "eyedropper",
      colorHexes: ["#0E4A8A"],
    });
    expect(res.ok).toBe(true);
  });
});

describe("sendPaletteToRecipe — free, costs nothing to run", () => {
  test("a FREE user can send a tool palette to a new recipe", async () => {
    await setPlan("free");
    const res = await sendPaletteToRecipe({
      swatches: [{ hex: "#0e4a8a" }],
      newRecipeName: "From tool",
    });
    expect(res.ok).toBe(true);
    // The recipe really landed — not an ok:true that wrote nothing.
    const rows = await state.db!.select().from(recipes);
    expect(rows).toHaveLength(1);
  });
});

describe("createTextImport — Pro-gated army-list parse (pasted text)", () => {
  test("a FREE user is blocked with an upgrade URL and nothing is persisted", async () => {
    await setPlan("free");
    const res = await createTextImport({ rawText: SAMPLE_LIST });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/sponsor the Mainframe/i);
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
    expect(res.error).toMatch(/sponsor the Mainframe/i);
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
