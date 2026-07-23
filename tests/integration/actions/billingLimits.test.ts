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

/**
 * P10.2 — integration tests for the free-tier server-action gates.
 *
 * As of the subscription-paywall build (docs/SUBSCRIPTION_PAYWALL.md fix 3),
 * `createProject`, `createRecipe`, and `createWishlistItem` are ALL
 * unlimited on every plan — the free/paid boundary is entirely about which
 * FEATURES a user can reach (isProUser, enforce.ts), not resource counts.
 * This suite proves that emptily (every create succeeds, on free and paid
 * alike); the gate-shape tests (upgradeUrl on a REAL limit failure) live in
 * the "ActionResult shape" describe block below via a validation failure,
 * since there's no longer a real cap failure to exercise here.
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

describe("createRecipe — free tier recipes are UNLIMITED (no per-node cap)", () => {
  test("first recipe succeeds on a fresh free account", async () => {
    const result = await createRecipe({ name: "Salamanders" });
    expect(result.ok).toBe(true);
    const rows = await state.db!.select().from(recipes);
    expect(rows).toHaveLength(1);
  });

  // Gating-layer model (fix 3, docs/SUBSCRIPTION_PAYWALL.md) — the
  // per-project-node cap is removed; a free user can keep adding recipes to
  // the SAME node (standalone or attached to one project) without limit.
  // This is NOT gated by BILLING_ENFORCED.
  test("a second STANDALONE recipe (same null node) is also allowed", async () => {
    await seedRecipesUnderNode(1, null);
    const result = await createRecipe({ name: "Second standalone" });
    expect(result.ok).toBe(true);
    const rows = await state.db!.select().from(recipes);
    expect(rows).toHaveLength(2);
  });

  test("a second recipe under the SAME PROJECT node is also allowed", async () => {
    const projectId = await seedProject();
    await seedRecipesUnderNode(1, projectId);
    const result = await createRecipe({
      name: "Second on project",
      attachedProjectId: projectId,
    });
    expect(result.ok).toBe(true);
  });

  test("a recipe on project A does not affect a first recipe on project B", async () => {
    const projectA = await seedProject();
    const projectB = await seedProject();
    await seedRecipesUnderNode(1, projectA);
    const result = await createRecipe({
      name: "First on B",
      attachedProjectId: projectB,
    });
    expect(result.ok).toBe(true);
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
