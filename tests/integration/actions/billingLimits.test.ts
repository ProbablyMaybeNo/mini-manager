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

// Stub the scrape so the uncapped-scrape test drives a deterministic,
// USABLE product (no real network) — J1 now returns an honest "unreadable"
// failure for a no-result scrape, so a bare hostname URL is no longer a
// stand-in for "the cap didn't block me".
const scrapeMock = vi.hoisted(() => ({ scrapeUrl: vi.fn() }));
vi.mock("@/lib/scrape", () => scrapeMock);

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

/** Seed one owned project and return its id (a recipe "node"). */
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

/** Seed `n` recipes attached to a specific node (or standalone if null). */
async function seedRecipesUnderNode(
  n: number,
  attachedProjectId: string | null,
): Promise<void> {
  for (let i = 0; i < n; i++) {
    await state.db!.insert(recipes).values({
      id: nanoid(16),
      ownerId: state.userId,
      name: `Node recipe ${i}`,
      bodyType: "infantry",
      attachedProjectId,
      isStandalone: attachedProjectId === null,
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

describe("createProject — free tier projects are UNLIMITED", () => {
  test("first project succeeds on a fresh free account", async () => {
    const result = await createProject({ name: "First", type: "Unit", count: 1 });
    const rows = await state.db!.select().from(projects);
    expect(rows).toHaveLength(1);
    expect(result.ok).toBe(true);
  });

  // Gating-layer model — free is unlimited on projects (the cap moved to
  // recipes, per-node). So a free user can keep adding projects today AND
  // when billing goes live; this is NOT gated by BILLING_ENFORCED.
  test("a free user can create many projects (no per-account project cap)", async () => {
    await seedProjectsForUser(3);
    const result = await createProject({ name: "Fourth", type: "Unit", count: 1 });
    expect(result.ok).toBe(true);
    const rows = await state.db!.select().from(projects);
    expect(rows).toHaveLength(4);
  });
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

describe("createRecipe — free tier cap is PER PROJECT NODE (1 / node)", () => {
  test("first recipe succeeds on a fresh free account", async () => {
    const result = await createRecipe({ name: "Salamanders" });
    expect(result.ok).toBe(true);
    const rows = await state.db!.select().from(recipes);
    expect(rows).toHaveLength(1);
  });

  // --- standalone node (attachedProjectId === null) ---
  itWhenEnforced(
    "second STANDALONE recipe is blocked (same null node) + upgrade URL",
    async () => {
      await seedRecipesUnderNode(1, null);
      const result = await createRecipe({ name: "Second standalone" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/Free tier limit reached/);
      expect(result.upgradeUrl).toBe("/pricing");
      // Gate ran before the insert — still just the 1 seeded standalone row.
      const rows = await state.db!.select().from(recipes);
      expect(rows).toHaveLength(1);
    },
  );

  // --- per-project node ---
  itWhenEnforced(
    "second recipe UNDER THE SAME PROJECT is blocked + upgrade URL",
    async () => {
      const projectId = await seedProject();
      await seedRecipesUnderNode(1, projectId);
      const result = await createRecipe({
        name: "Second on project",
        attachedProjectId: projectId,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/Free tier limit reached/);
      expect(result.upgradeUrl).toBe("/pricing");
    },
  );

  // The defining property of the per-node cap: a recipe already on one
  // project must NOT block a recipe on a DIFFERENT project, and must not
  // block the user's first standalone recipe. This is the behaviour that
  // separates a per-node cap from a per-account total — assert it even
  // while enforcement is on.
  itWhenEnforced(
    "a recipe on project A does NOT block a first recipe on project B",
    async () => {
      const projectA = await seedProject();
      const projectB = await seedProject();
      await seedRecipesUnderNode(1, projectA);
      const result = await createRecipe({
        name: "First on B",
        attachedProjectId: projectB,
      });
      expect(result.ok).toBe(true);
    },
  );

  itWhenEnforced(
    "a recipe on a project does NOT block a first standalone recipe",
    async () => {
      const projectId = await seedProject();
      await seedRecipesUnderNode(1, projectId);
      const result = await createRecipe({ name: "First standalone" });
      expect(result.ok).toBe(true);
    },
  );

  // While billing is off there's no upgrade path, so even the 2nd recipe
  // under one node is allowed today (caps lifted pre-Stripe).
  test.skipIf(BILLING_ENFORCED)(
    "second recipe under the same node IS allowed while billing is off",
    async () => {
      const projectId = await seedProject();
      await seedRecipesUnderNode(1, projectId);
      const result = await createRecipe({
        name: "Second on project (off)",
        attachedProjectId: projectId,
      });
      expect(result.ok).toBe(true);
      const rows = await state.db!.select().from(recipes);
      expect(rows).toHaveLength(2);
    },
  );
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

describe("createWishlistItem — free tier collection is UNLIMITED", () => {
  test("first three items succeed on a fresh free account", async () => {
    for (let i = 0; i < 3; i++) {
      const result = await createWishlistItem({ title: `Item ${i}` });
      expect(result.ok).toBe(true);
    }
    const rows = await state.db!.select().from(wishlistItems);
    expect(rows).toHaveLength(3);
  });

  // Gating-layer model — free collection/wishlist is unlimited (the cap
  // moved to recipes, per-node). A free user keeps adding today AND at
  // launch; this is NOT gated by BILLING_ENFORCED.
  test("a free user can add a fourth+ item (no per-account collection cap)", async () => {
    await seedWishlistForUser(3);
    const result = await createWishlistItem({ title: "Fourth" });
    expect(result.ok).toBe(true);
    const rows = await state.db!.select().from(wishlistItems);
    expect(rows).toHaveLength(4);
  });

  test("the scrape path is also uncapped on free", async () => {
    scrapeMock.scrapeUrl.mockResolvedValueOnce({
      title: "Widget",
      vendor: "Some Shop",
      price: 9.99,
      raw: { parser: "og" },
    });
    await seedWishlistForUser(3);
    const result = await scrapeAndCreateWishlistItem({
      url: "https://example.com/widget",
    });
    expect(result.ok).toBe(true);
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
