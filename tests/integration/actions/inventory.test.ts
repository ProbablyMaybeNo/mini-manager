import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { inventoryEntries } from "@/db/schema";

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

const { setOwnedCount, toggleWishlistedPaint, markPurchased, addPaintToOwned, addPaintToWishlist } =
  await import("@/lib/actions/inventory");

const PAINT = "citadel-mephiston-red";

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("setOwnedCount", () => {
  test("creates an inventory entry on first set", async () => {
    const res = await setOwnedCount({ paintId: PAINT, count: 3 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.ownedCount).toBe(3);

    const rows = await state.db!.select().from(inventoryEntries);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.paintId).toBe(PAINT);
  });

  test("updates the existing entry rather than duplicating", async () => {
    await setOwnedCount({ paintId: PAINT, count: 3 });
    const res = await setOwnedCount({ paintId: PAINT, count: 7 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.ownedCount).toBe(7);

    const rows = await state.db!.select().from(inventoryEntries);
    expect(rows).toHaveLength(1);
  });

  test("allows setting count to 0", async () => {
    const res = await setOwnedCount({ paintId: PAINT, count: 0 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.ownedCount).toBe(0);
  });

  test("rejects a negative count", async () => {
    const res = await setOwnedCount({ paintId: PAINT, count: -1 });
    expect(res.ok).toBe(false);
  });
});

describe("toggleWishlistedPaint", () => {
  test("turns the star on, then off", async () => {
    const first = await toggleWishlistedPaint({ paintId: PAINT });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.isWishlisted).toBe(true);

    const second = await toggleWishlistedPaint({ paintId: PAINT });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.isWishlisted).toBe(false);

    const rows = await state.db!.select().from(inventoryEntries);
    expect(rows).toHaveLength(1);
  });

  test("preserves owned count when toggling the star", async () => {
    await setOwnedCount({ paintId: PAINT, count: 4 });
    const res = await toggleWishlistedPaint({ paintId: PAINT });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.isWishlisted).toBe(true);
    expect(res.data.ownedCount).toBe(4);
  });
});

describe("markPurchased", () => {
  test("increments owned count and records purchase time", async () => {
    const res = await markPurchased({ paintId: PAINT, deltaCount: 2 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.ownedCount).toBe(2);
    expect(res.data.lastPurchasedAt).not.toBeNull();
  });

  test("accumulates across repeated purchases", async () => {
    await markPurchased({ paintId: PAINT, deltaCount: 2 });
    const res = await markPurchased({ paintId: PAINT, deltaCount: 3 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.ownedCount).toBe(5);
  });

  test("rejects a non-positive delta", async () => {
    const res = await markPurchased({ paintId: PAINT, deltaCount: 0 });
    expect(res.ok).toBe(false);
  });
});

describe("addPaintToOwned", () => {
  test("marks a never-owned paint owned at count 1", async () => {
    const res = await addPaintToOwned({ paintId: PAINT });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.already).toBe(false);
    expect(res.data.entry.ownedCount).toBe(1);
  });

  test("does not clobber an existing higher count down to 1", async () => {
    await setOwnedCount({ paintId: PAINT, count: 5 });
    const res = await addPaintToOwned({ paintId: PAINT });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.already).toBe(true);
    expect(res.data.entry.ownedCount).toBe(5);

    const rows = await state.db!.select().from(inventoryEntries);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.ownedCount).toBe(5);
  });

  test("a zero count is treated as not-yet-owned and raised to 1", async () => {
    await setOwnedCount({ paintId: PAINT, count: 0 });
    const res = await addPaintToOwned({ paintId: PAINT });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.already).toBe(false);
    expect(res.data.entry.ownedCount).toBe(1);
  });
});

describe("addPaintToWishlist", () => {
  test("wishlists a paint that isn't on it yet", async () => {
    const res = await addPaintToWishlist({ paintId: PAINT });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.already).toBe(false);
    expect(res.data.entry.isWishlisted).toBe(true);
  });

  test("does not toggle an already-wishlisted paint back off", async () => {
    await toggleWishlistedPaint({ paintId: PAINT });
    const res = await addPaintToWishlist({ paintId: PAINT });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.already).toBe(true);
    expect(res.data.entry.isWishlisted).toBe(true);

    const rows = await state.db!.select().from(inventoryEntries);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.isWishlisted).toBe(true);
  });

  test("preserves owned count when adding to the wishlist", async () => {
    await setOwnedCount({ paintId: PAINT, count: 4 });
    const res = await addPaintToWishlist({ paintId: PAINT });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.entry.isWishlisted).toBe(true);
    expect(res.data.entry.ownedCount).toBe(4);
  });
});

describe("ownership isolation", () => {
  test("two users keep independent entries for the same paint", async () => {
    await setOwnedCount({ paintId: PAINT, count: 5 });

    const otherUserId = await seedExtraUser(state.db!);
    state.userId = otherUserId;
    await setOwnedCount({ paintId: PAINT, count: 1 });

    const mine = await state.db!
      .select()
      .from(inventoryEntries)
      .where(eq(inventoryEntries.ownerId, otherUserId));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.ownedCount).toBe(1);

    const all = await state.db!.select().from(inventoryEntries);
    expect(all).toHaveLength(2);
  });
});
