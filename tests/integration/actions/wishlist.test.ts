import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { wishlistItems } from "@/db/schema";

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

// The scrape pipeline is tested separately — stub it so the wishlist
// actions don't accidentally fetch real vendor URLs in this suite.
const scrapeMock = vi.hoisted(() => ({ scrapeUrl: vi.fn() }));
vi.mock("@/lib/scrape", () => scrapeMock);

const {
  createWishlistItem,
  updateWishlistItem,
  setWishlistStatus,
  scrapeAndCreateWishlistItem,
} = await import("@/lib/actions/wishlist");

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("createWishlistItem", () => {
  test("creates a minimal row with sensible defaults", async () => {
    const res = await createWishlistItem({ title: "Citadel Mephiston Red" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.title).toBe("Citadel Mephiston Red");
    expect(res.data.status).toBe("WISHLIST");
    expect(res.data.priority).toBe("Medium");
    expect(res.data.category).toBe("Other");
    expect(res.data.currency).toBe("USD");
  });

  test("stores price as integer cents", async () => {
    const res = await createWishlistItem({
      title: "Element Games Paint",
      price: 2.65,
      currency: "GBP",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // schema column is price_cents — Drizzle JS prop is `price`
    expect(res.data.price).toBe(265);
    expect(res.data.currency).toBe("GBP");
  });

  test("rejects empty title", async () => {
    const res = await createWishlistItem({ title: "  " });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Title is required/);
  });

  test("rejects invalid currency length", async () => {
    const res = await createWishlistItem({
      title: "X",
      currency: "POUND",
    });
    expect(res.ok).toBe(false);
  });
});

describe("updateWishlistItem", () => {
  test("updates title and price", async () => {
    const created = await createWishlistItem({ title: "Old", price: 1 });
    if (!created.ok) throw new Error("setup failed");

    const res = await updateWishlistItem({
      id: created.data.id,
      title: "New",
      price: 9.99,
    });
    expect(res.ok).toBe(true);

    const [row] = await state
      .db!.select()
      .from(wishlistItems)
      .where(eq(wishlistItems.id, created.data.id));
    expect(row!.title).toBe("New");
    expect(row!.price).toBe(999);
  });

  test("rejects updating a row owned by someone else", async () => {
    const created = await createWishlistItem({ title: "Mine" });
    if (!created.ok) throw new Error("setup failed");

    state.userId = "intruder";
    const res = await updateWishlistItem({
      id: created.data.id,
      title: "Hijacked",
    });
    expect(res.ok).toBe(false);
  });
});

describe("scrapeAndCreateWishlistItem — kind routing (MM-36)", () => {
  beforeEach(() => {
    // A title the heuristic classifies as a paint (no model terms, a
    // non-mini vendor). Proves the explicit kind override wins.
    scrapeMock.scrapeUrl.mockResolvedValue({
      title: "Mephiston Red",
      vendor: "Some Shop",
      raw: { parser: "og" },
    });
  });

  afterEach(() => {
    scrapeMock.scrapeUrl.mockReset();
  });

  test("routes a pasted URL to the MODEL table when model is selected", async () => {
    const res = await scrapeAndCreateWishlistItem({
      url: "https://example.com/p",
      kind: "model",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.kind).toBe("model");
  });

  test("routes a pasted URL to the PAINT table when paint is selected", async () => {
    const res = await scrapeAndCreateWishlistItem({
      url: "https://example.com/p",
      kind: "paint",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.kind).toBe("paint");
  });

  test("falls back to the title heuristic when no kind is supplied", async () => {
    scrapeMock.scrapeUrl.mockResolvedValueOnce({
      title: "Ork Boyz Box",
      vendor: "Some Shop",
      raw: { parser: "og" },
    });
    const res = await scrapeAndCreateWishlistItem({ url: "https://example.com/box" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // "box" → model via inferWishlistKind.
    expect(res.data.kind).toBe("model");
  });
});

describe("setWishlistStatus", () => {
  test("stamps dateResolved when leaving Wanted", async () => {
    const created = await createWishlistItem({ title: "Buy me" });
    if (!created.ok) throw new Error("setup failed");

    const res = await setWishlistStatus({
      id: created.data.id,
      status: "PURCHASED",
    });
    expect(res.ok).toBe(true);

    const [row] = await state
      .db!.select()
      .from(wishlistItems)
      .where(eq(wishlistItems.id, created.data.id));
    expect(row!.status).toBe("PURCHASED");
    expect(row!.dateResolved).not.toBeNull();
  });

  test("clears dateResolved when status goes back to Wanted", async () => {
    const created = await createWishlistItem({ title: "Buy me" });
    if (!created.ok) throw new Error("setup failed");

    await setWishlistStatus({ id: created.data.id, status: "PURCHASED" });
    await setWishlistStatus({ id: created.data.id, status: "WISHLIST" });

    const [row] = await state
      .db!.select()
      .from(wishlistItems)
      .where(eq(wishlistItems.id, created.data.id));
    expect(row!.status).toBe("WISHLIST");
    expect(row!.dateResolved).toBeNull();
  });
});
