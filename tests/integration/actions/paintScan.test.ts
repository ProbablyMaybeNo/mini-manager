/**
 * "Scan paints from a photo" — vision (mocked) -> catalog match -> confirm
 * -> bulk-add. Runs against a real in-memory libsql DB with all migrations
 * applied; the vision client and the paint catalog are both mocked so the
 * matching outcome is deterministic and the test never hits the network or
 * requires a real ANTHROPIC_API_KEY.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { users, wishlistItems } from "@/db/schema";
import type { Paint } from "@/lib/paints/types";
import type { ExtractedPaintLabel } from "@/lib/paints/matchScan";

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  userId: "" as string,
}));

// Controllable vision output — defaults to a clean two-paint read that the
// fixture catalog below can match confidently.
const vision = vi.hoisted(() => ({
  extracted: [
    { brand: "Citadel", name: "Mephiston Red" },
    { brand: "The Army Painter", name: "Matt Black" },
  ] as { brand: string; name: string }[],
}));

const FIXTURE_CATALOG: Paint[] = [
  {
    id: "c1",
    brand: "Citadel",
    name: "Mephiston Red",
    type: "Paint",
    hex: "#7a1717",
    hexConfidence: "high",
    hexSource: "test",
    sourceUrl: "https://example.com/c1",
  },
  {
    id: "ap1",
    brand: "The Army Painter",
    name: "Matt Black",
    type: "Paint",
    hex: "#0a0a0a",
    hexConfidence: "high",
    hexSource: "test",
    sourceUrl: "https://example.com/ap1",
  },
  {
    id: "v1",
    brand: "Vallejo Model Color",
    name: "Ivory",
    type: "Paint",
    hex: "#f0e6d2",
    hexConfidence: "high",
    hexSource: "test",
    sourceUrl: "https://example.com/v1",
  },
];

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
vi.mock("@/lib/paints/serverCatalog", () => ({
  getServerCatalog: async () => FIXTURE_CATALOG,
}));
vi.mock("@/lib/ai/paintScan", () => ({
  scanPaintLabels: async (): Promise<ExtractedPaintLabel[]> => vision.extracted,
}));

const { scanPaintsFromPhoto } = await import("@/lib/actions/paintScan");
const { bulkAddPaintsToCollection } = await import("@/lib/actions/paintOwnership");

function scanFixture() {
  return scanPaintsFromPhoto({ imageBase64: "AAAA", mediaType: "image/jpeg" });
}

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
  vision.extracted = [
    { brand: "Citadel", name: "Mephiston Red" },
    { brand: "The Army Painter", name: "Matt Black" },
  ];
});

afterEach(() => {
  state.db = null;
  state.userId = "";
  delete process.env.MM_SCAN_DAILY_LIMIT;
});

describe("scanPaintsFromPhoto", () => {
  test("matches vision-extracted labels against the catalog", async () => {
    const res = await scanFixture();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.items).toHaveLength(2);
    expect(res.data.items[0]?.extracted).toEqual({ brand: "Citadel", name: "Mephiston Red" });
    expect(res.data.items[0]?.match?.id).toBe("c1");
    expect(res.data.items[1]?.match?.id).toBe("ap1");
  });

  test("a photo with no readable labels is refused with a friendly error", async () => {
    vision.extracted = [];
    const res = await scanFixture();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/couldn.t read/i);
  });

  test("an unmatched label still comes back with match:null (never crashes)", async () => {
    vision.extracted = [{ brand: "Nonexistent Brand", name: "Nonexistent Paint" }];
    const res = await scanFixture();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.items[0]?.match).toBeNull();
  });

  describe("paint-scan daily quota (E7)", () => {
    test("refuses the N+1th scan from one user in a day", async () => {
      process.env.MM_SCAN_DAILY_LIMIT = "2";
      const first = await scanFixture();
      const second = await scanFixture();
      const third = await scanFixture();

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      expect(third.ok).toBe(false);
      if (third.ok) return;
      expect(third.error).toMatch(/paint-scan limit/i);
    });
  });

  // Subscription paywall (fix 1: "no free AI, no exceptions") — Paint
  // Scanner is subscriber-only on EVERY entry point (the Collection page's
  // "Scan paints" button and the Tools-hub Paint Scanner both call this
  // exact action; there is no free surface anymore).
  describe("scanPaintsFromPhoto — always subscriber-gated", () => {
    test("blocked for a free (non-subscriber) user", async () => {
      await state.db!.update(users).set({ plan: "free" }).where(eq(users.id, state.userId));
      const res = await scanPaintsFromPhoto({ imageBase64: "AAAA", mediaType: "image/jpeg" });
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toMatch(/sponsor the Mainframe/i);
      expect(res.upgradeUrl).toBe("/pricing");
    });

    test("succeeds for a pro_monthly subscriber", async () => {
      await state.db!.update(users).set({ plan: "pro_monthly" }).where(eq(users.id, state.userId));
      const res = await scanPaintsFromPhoto({ imageBase64: "AAAA", mediaType: "image/jpeg" });
      expect(res.ok).toBe(true);
    });

    test("the free gate runs BEFORE the daily-quota check and the vision call", async () => {
      await state.db!.update(users).set({ plan: "free" }).where(eq(users.id, state.userId));
      process.env.MM_SCAN_DAILY_LIMIT = "2";
      const res = await scanPaintsFromPhoto({ imageBase64: "AAAA", mediaType: "image/jpeg" });
      expect(res.ok).toBe(false);
      if (res.ok) return;
      // Pro-gate error, NOT the daily-quota error — proves the gate is
      // checked first and the (paid) vision call never fires for free users.
      expect(res.error).toMatch(/sponsor the Mainframe/i);
      expect(res.error).not.toMatch(/paint-scan limit/i);
    });
  });
});

describe("scan -> confirm -> bulk add (end to end)", () => {
  test("confirmed matches persist to Collection via the existing bulk-add path", async () => {
    const scanRes = await scanFixture();
    expect(scanRes.ok).toBe(true);
    if (!scanRes.ok) return;

    const ownedIds = scanRes.data.items
      .filter((i) => i.extracted.brand === "Citadel")
      .map((i) => i.match!.id);
    const wishlistIds = scanRes.data.items
      .filter((i) => i.extracted.brand === "The Army Painter")
      .map((i) => i.match!.id);

    const ownedRes = await bulkAddPaintsToCollection({ paintIds: ownedIds, status: "OWNED" });
    const wishlistRes = await bulkAddPaintsToCollection({ paintIds: wishlistIds, status: "WISHLIST" });
    expect(ownedRes.ok).toBe(true);
    expect(wishlistRes.ok).toBe(true);
    if (!ownedRes.ok || !wishlistRes.ok) return;

    expect(ownedRes.data.items).toHaveLength(1);
    expect(ownedRes.data.items[0]?.paintId).toBe("c1");
    expect(ownedRes.data.items[0]?.status).toBe("OWNED");
    expect(ownedRes.data.items[0]?.title).toBe("Mephiston Red");
    expect(ownedRes.data.items[0]?.company).toBe("Citadel");

    expect(wishlistRes.data.items).toHaveLength(1);
    expect(wishlistRes.data.items[0]?.paintId).toBe("ap1");
    expect(wishlistRes.data.items[0]?.status).toBe("WISHLIST");

    const rows = await state
      .db!.select()
      .from(wishlistItems)
      .where(and(eq(wishlistItems.ownerId, state.userId), eq(wishlistItems.kind, "paint")));
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.paintId === "c1" && r.status === "OWNED")).toBe(true);
    expect(rows.some((r) => r.paintId === "ap1" && r.status === "WISHLIST")).toBe(true);
  });

  test("an item the painter skips (no catalog id supplied) never gets added", async () => {
    const scanRes = await scanFixture();
    expect(scanRes.ok).toBe(true);
    if (!scanRes.ok) return;

    // Painter confirms only the Citadel match, skips the Army Painter one.
    const ownedIds = scanRes.data.items
      .filter((i) => i.extracted.brand === "Citadel")
      .map((i) => i.match!.id);
    await bulkAddPaintsToCollection({ paintIds: ownedIds, status: "OWNED" });

    const rows = await state
      .db!.select()
      .from(wishlistItems)
      .where(and(eq(wishlistItems.ownerId, state.userId), eq(wishlistItems.kind, "paint")));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.paintId).toBe("c1");
  });
});
