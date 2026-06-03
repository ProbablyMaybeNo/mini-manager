import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import {
  projects,
  recipes,
  users,
  wishlistItems,
} from "@/db/schema";
import { BILLING_ENFORCED } from "@/lib/billing/plans";

// Free-tier ENFORCEMENT is gated off until Stripe is live (BILLING_ENFORCED
// = false) — with no upgrade path, the caps can't bite or the beta is
// untestable. The four "is blocked" tests below assert enforcement, so they
// skip while it's off and run again the moment the Stripe wire-up flips the
// flag. The cap MATH stays covered in plans.test.ts via isWithinPlanLimit.
const itWhenEnforced = test.skipIf(!BILLING_ENFORCED);

/**
 * P10.2 — integration tests for the free-tier server-action gates.
 *
 *   createProject     blocks the 2nd row on free, allows N on paid
 *   createRecipe      blocks the 2nd row on free, allows N on paid
 *   createWishlistItem  blocks the 4th row on free, allows N on paid
 *
 * Each test seeds the test DB to the cap (or just under), then asserts
 * the gate's shape on the next create. Paid tiers seed a user with the
 * plan column flipped + no expiry, so getPlanForUser resolves "pro_*"
 * and isWithinLimit returns Infinity.
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
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { createProject } = await import("@/lib/actions/projects");
const { createRecipe } = await import("@/lib/actions/recipes");
const { createWishlistItem, scrapeAndCreateWishlistItem } = await import(
  "@/lib/actions/wishlist"
);
const { redirect } = await import("next/navigation");

async function setUserPlan(plan: string): Promise<void> {
  await state.db!.update(users).set({ plan }).where(eq(users.id, state.userId));
}

async function seedProjectsForUser(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await state.db!.insert(projects).values({
      id: nanoid(16),
      ownerId: state.userId,
      type: "Unit",
      name: `Seeded ${i}`,
      count: 1,
    });
  }
}

async function seedRecipesForUser(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await state.db!.insert(recipes).values({
      id: nanoid(16),
      ownerId: state.userId,
      name: `Seeded recipe ${i}`,
      bodyType: "infantry",
      isStandalone: true,
    });
  }
}

async function seedWishlistForUser(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await state.db!.insert(wishlistItems).values({
      id: nanoid(16),
      ownerId: state.userId,
      title: `Seeded wishlist ${i}`,
    });
  }
}

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
  // The shared test-DB helper defaults to plan="pro_lifetime" so the
  // bulk of the integration suite doesn't get blocked by free-tier
  // gates. THIS suite is specifically about gate behaviour, so flip
  // the default user back to "free" — individual tests below opt into
  // a paid plan via setUserPlan() when they need it.
  await db.update(users).set({ plan: "free" }).where(eq(users.id, userId));
  vi.mocked(redirect).mockClear();
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

/* ============================================================
   createProject gate
   ============================================================ */

describe("createProject — free tier cap (1 project)", () => {
  test("first project succeeds on a fresh free account", async () => {
    await createProject({ name: "First", type: "Unit", count: 1 });
    const rows = await state.db!.select().from(projects);
    expect(rows).toHaveLength(1);
    expect(vi.mocked(redirect)).toHaveBeenCalled();
  });

  itWhenEnforced("second project is blocked with the free-tier error + upgrade URL", async () => {
    await seedProjectsForUser(1);
    const result = await createProject({
      name: "Second",
      type: "Unit",
      count: 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Free tier limit reached/);
    expect(result.upgradeUrl).toBe("/pricing");
    // Still only the 1 seeded row — gate ran before the insert.
    const rows = await state.db!.select().from(projects);
    expect(rows).toHaveLength(1);
    // Redirect must NOT have fired (we rejected before the success path).
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });

  test.skipIf(BILLING_ENFORCED)(
    "second project IS allowed while billing is off (caps lifted pre-Stripe)",
    async () => {
      await seedProjectsForUser(1);
      await createProject({ name: "Second", type: "Unit", count: 1 });
      const rows = await state.db!.select().from(projects);
      expect(rows).toHaveLength(2);
    },
  );
});

describe("createProject — paid tiers unlimited", () => {
  test("pro_monthly user with 5 existing projects can create a 6th", async () => {
    await setUserPlan("pro_monthly");
    await seedProjectsForUser(5);
    const result = await createProject({
      name: "Sixth",
      type: "Unit",
      count: 1,
    });
    // Success throws via redirect; result is the mock redirect's undefined
    // return. Either way, the gate didn't block — confirm by counting.
    const rows = await state.db!.select().from(projects);
    expect(rows).toHaveLength(6);
    void result;
  });

  test("pro_lifetime user with 50 existing projects can create a 51st", async () => {
    await setUserPlan("pro_lifetime");
    await seedProjectsForUser(50);
    await createProject({ name: "Fifty-first", type: "Unit", count: 1 });
    const rows = await state.db!.select().from(projects);
    expect(rows).toHaveLength(51);
  });
});

/* ============================================================
   createRecipe gate
   ============================================================ */

describe("createRecipe — free tier cap (1 recipe)", () => {
  test("first recipe succeeds on a fresh free account", async () => {
    const result = await createRecipe({ name: "Salamanders" });
    expect(result.ok).toBe(true);
    const rows = await state.db!.select().from(recipes);
    expect(rows).toHaveLength(1);
  });

  itWhenEnforced("second recipe is blocked with the free-tier error + upgrade URL", async () => {
    await seedRecipesForUser(1);
    const result = await createRecipe({ name: "Second" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Free tier limit reached/);
    expect(result.upgradeUrl).toBe("/pricing");
    const rows = await state.db!.select().from(recipes);
    expect(rows).toHaveLength(1);
  });
});

describe("createRecipe — paid tiers unlimited", () => {
  test("pro_monthly user with 5 existing recipes can create a 6th", async () => {
    await setUserPlan("pro_monthly");
    await seedRecipesForUser(5);
    const result = await createRecipe({ name: "Sixth" });
    expect(result.ok).toBe(true);
    const rows = await state.db!.select().from(recipes);
    expect(rows).toHaveLength(6);
  });
});

/* ============================================================
   createWishlistItem gate (cap = 3)
   ============================================================ */

describe("createWishlistItem — free tier cap (3 items)", () => {
  test("first three items succeed on a fresh free account", async () => {
    for (let i = 0; i < 3; i++) {
      const result = await createWishlistItem({ title: `Item ${i}` });
      expect(result.ok).toBe(true);
    }
    const rows = await state.db!.select().from(wishlistItems);
    expect(rows).toHaveLength(3);
  });

  itWhenEnforced("fourth item is blocked with the free-tier error + upgrade URL", async () => {
    await seedWishlistForUser(3);
    const result = await createWishlistItem({ title: "Fourth" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Free tier limit reached/);
    expect(result.upgradeUrl).toBe("/pricing");
    const rows = await state.db!.select().from(wishlistItems);
    expect(rows).toHaveLength(3);
  });

  itWhenEnforced("scrape path enforces the same cap (gate fires BEFORE the scrape)", async () => {
    await seedWishlistForUser(3);
    // The URL doesn't matter — the gate should reject before any HTTP work.
    const result = await scrapeAndCreateWishlistItem({
      url: "https://example.com/widget",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Free tier limit reached/);
    expect(result.upgradeUrl).toBe("/pricing");
    // Still only the 3 seeded rows — no scrape produced a 4th.
    const rows = await state.db!.select().from(wishlistItems);
    expect(rows).toHaveLength(3);
  });
});

describe("createWishlistItem — paid tiers unlimited", () => {
  test("pro_lifetime user with 50 existing wishlist items can create a 51st", async () => {
    await setUserPlan("pro_lifetime");
    await seedWishlistForUser(50);
    const result = await createWishlistItem({ title: "Fifty-first" });
    expect(result.ok).toBe(true);
    const rows = await state.db!.select().from(wishlistItems);
    expect(rows).toHaveLength(51);
  });

  test("founderClaimedAt user gets the founder lane unlocked even on plan=free", async () => {
    // Founder one-time purchase stamps founder_claimed_at — the plan
    // column may stay "free" if the webhook hasn't synced yet, but
    // getPlanForUser prioritises the stamp.
    await state
      .db!.update(users)
      .set({ founderClaimedAt: new Date(), plan: "free" })
      .where(eq(users.id, state.userId));
    await seedWishlistForUser(3);
    const result = await createWishlistItem({ title: "Founder add" });
    expect(result.ok).toBe(true);
  });
});

/* ============================================================
   ActionResult shape: failures retain upgradeUrl for caller consumption
   ============================================================ */

describe("ActionResult shape", () => {
  test("non-limit failures DO NOT carry an upgradeUrl", async () => {
    // Validation failures (empty name) should return ok: false WITHOUT
    // upgradeUrl set. The client UI uses upgradeUrl as the discriminator
    // for whether to render the inline "Upgrade →" link.
    const result = await createProject({ name: "", type: "Unit", count: 1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Name is required/);
    expect(result.upgradeUrl).toBeUndefined();
  });
});
