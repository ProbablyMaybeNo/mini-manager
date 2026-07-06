import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { inventoryEntries, wishlistItems } from "@/db/schema";

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

const { reconcilePaintOwnership, listLinkedPaintStatuses } = await import(
  "@/lib/paints/reconcileOwnership"
);
const { setWishlistStatus, updateWishlistItem, deleteWishlistItem } = await import(
  "@/lib/actions/wishlist"
);
const { getInventoryEntry } = await import("@/db/queries/inventory");

// A real catalog entry (public/data/paints.json) — brand "AK Interactive",
// name "Black" — so the catalog-fill assertions are against real data.
const REAL_PAINT_ID = "14557";
const REAL_PAINT_BRAND = "AK Interactive";
const REAL_PAINT_NAME = "Black";
const UNKNOWN_PAINT_ID = "not-a-real-catalog-id-xyz";

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

async function linkedRowsFor(paintId: string) {
  return state
    .db!.select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.ownerId, state.userId), eq(wishlistItems.paintId, paintId)));
}

describe("reconcilePaintOwnership — WISHLIST/OWNED/NONE transitions", () => {
  test("OWNED creates inventory_entry + a linked collection row filled from the catalog", async () => {
    const { inventory, linkedItem } = await reconcilePaintOwnership(
      state.userId,
      REAL_PAINT_ID,
      "OWNED",
    );
    expect(inventory.ownedCount).toBe(1);
    expect(inventory.isWishlisted).toBe(false);

    expect(linkedItem).not.toBeNull();
    expect(linkedItem!.kind).toBe("paint");
    expect(linkedItem!.paintId).toBe(REAL_PAINT_ID);
    expect(linkedItem!.status).toBe("OWNED");
    expect(linkedItem!.title).toBe(REAL_PAINT_NAME);
    expect(linkedItem!.company).toBe(REAL_PAINT_BRAND);
    expect(linkedItem!.paintType).toBe("Acrylic"); // catalog type "Paint" -> "Acrylic"
    expect(linkedItem!.price).toBeNull(); // MANUAL pricing — Phase 2 scrapes it

    const rows = await linkedRowsFor(REAL_PAINT_ID);
    expect(rows).toHaveLength(1);
  });

  test("WISHLIST creates a linked row with status WISHLIST", async () => {
    const { inventory, linkedItem } = await reconcilePaintOwnership(
      state.userId,
      REAL_PAINT_ID,
      "WISHLIST",
    );
    expect(inventory.ownedCount).toBe(0);
    expect(inventory.isWishlisted).toBe(true);
    expect(linkedItem!.status).toBe("WISHLIST");
  });

  test("OWNED -> WISHLIST updates the SAME linked row rather than duplicating it", async () => {
    const first = await reconcilePaintOwnership(state.userId, REAL_PAINT_ID, "OWNED");
    const second = await reconcilePaintOwnership(state.userId, REAL_PAINT_ID, "WISHLIST");

    expect(second.linkedItem!.id).toBe(first.linkedItem!.id);
    expect(second.linkedItem!.status).toBe("WISHLIST");
    expect(second.inventory.isWishlisted).toBe(true);
    expect(second.inventory.ownedCount).toBe(0);

    const rows = await linkedRowsFor(REAL_PAINT_ID);
    expect(rows).toHaveLength(1);
  });

  test("NONE deletes the linked row and clears both inventory flags", async () => {
    await reconcilePaintOwnership(state.userId, REAL_PAINT_ID, "OWNED");
    const { inventory, linkedItem } = await reconcilePaintOwnership(
      state.userId,
      REAL_PAINT_ID,
      "NONE",
    );
    expect(linkedItem).toBeNull();
    expect(inventory.ownedCount).toBe(0);
    expect(inventory.isWishlisted).toBe(false);

    const rows = await linkedRowsFor(REAL_PAINT_ID);
    expect(rows).toHaveLength(0);
  });

  test("idempotent — calling the same status twice is a no-op the second time", async () => {
    await reconcilePaintOwnership(state.userId, REAL_PAINT_ID, "OWNED");
    const { inventory, linkedItem } = await reconcilePaintOwnership(
      state.userId,
      REAL_PAINT_ID,
      "OWNED",
    );
    expect(inventory.ownedCount).toBe(1);
    expect(linkedItem!.status).toBe("OWNED");
    const rows = await linkedRowsFor(REAL_PAINT_ID);
    expect(rows).toHaveLength(1);
  });

  test("re-affirming OWNED preserves an already-tracked ownedCount > 1", async () => {
    // Simulate the painter already tracking 5 tubes via the plain
    // setOwnedCount flow before ever touching the STATUS control.
    const { upsertInventoryEntry } = await import("@/db/queries/inventory");
    await upsertInventoryEntry(state.userId, REAL_PAINT_ID, { ownedCount: 5 });

    const { inventory } = await reconcilePaintOwnership(state.userId, REAL_PAINT_ID, "OWNED");
    expect(inventory.ownedCount).toBe(5);
  });

  test("unknown catalog id falls back to the paint id as the title, no company/type", async () => {
    const { linkedItem } = await reconcilePaintOwnership(state.userId, UNKNOWN_PAINT_ID, "OWNED");
    expect(linkedItem!.title).toBe(UNKNOWN_PAINT_ID);
    expect(linkedItem!.company).toBeNull();
    expect(linkedItem!.paintType).toBeNull();
  });

  test("dedupe — two pre-existing linked rows for the same paint collapse to one", async () => {
    // Simulate a bad prior state: two wishlist_item rows already linked to
    // the same (owner, paintId) pair (e.g. a race, a bad manual DB edit).
    await state.db!.insert(wishlistItems).values([
      {
        ownerId: state.userId,
        kind: "paint",
        paintId: REAL_PAINT_ID,
        title: "Older manual row",
        status: "WISHLIST",
      },
      {
        ownerId: state.userId,
        kind: "paint",
        paintId: REAL_PAINT_ID,
        title: "Newer duplicate row",
        status: "WISHLIST",
      },
    ]);
    expect(await linkedRowsFor(REAL_PAINT_ID)).toHaveLength(2);

    const { linkedItem } = await reconcilePaintOwnership(state.userId, REAL_PAINT_ID, "OWNED");

    const rows = await linkedRowsFor(REAL_PAINT_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("Older manual row"); // the earliest row wins
    expect(rows[0]!.status).toBe("OWNED");
    expect(linkedItem!.id).toBe(rows[0]!.id);
  });

  test("manual price/project edits on a linked row survive a status change", async () => {
    const { linkedItem } = await reconcilePaintOwnership(state.userId, REAL_PAINT_ID, "OWNED");
    // Simulate the painter manually pricing the linked row on /collection.
    await state
      .db!.update(wishlistItems)
      .set({ price: 999 })
      .where(eq(wishlistItems.id, linkedItem!.id));

    const { linkedItem: after } = await reconcilePaintOwnership(
      state.userId,
      REAL_PAINT_ID,
      "WISHLIST",
    );
    expect(after!.id).toBe(linkedItem!.id);
    expect(after!.price).toBe(999);
    expect(after!.status).toBe("WISHLIST");
  });

  test("ownership isolation — two users keep independent inventory rows and linked collection rows", async () => {
    await reconcilePaintOwnership(state.userId, REAL_PAINT_ID, "OWNED");

    const otherUserId = await seedExtraUser(state.db!);
    state.userId = otherUserId;
    await reconcilePaintOwnership(otherUserId, REAL_PAINT_ID, "WISHLIST");

    const mineInventory = await state
      .db!.select()
      .from(inventoryEntries)
      .where(eq(inventoryEntries.ownerId, otherUserId));
    expect(mineInventory).toHaveLength(1);
    expect(mineInventory[0]!.isWishlisted).toBe(true);

    const allLinked = await state
      .db!.select()
      .from(wishlistItems)
      .where(eq(wishlistItems.paintId, REAL_PAINT_ID));
    expect(allLinked).toHaveLength(2);
  });
});

describe("both-directions reflect — Collection edits mirror into inventory_entry", () => {
  test("setWishlistStatus on a linked row updates inventory_entry", async () => {
    const { linkedItem } = await reconcilePaintOwnership(state.userId, REAL_PAINT_ID, "OWNED");

    const res = await setWishlistStatus({ id: linkedItem!.id, status: "WISHLIST" });
    expect(res.ok).toBe(true);

    const entry = await getInventoryEntry(state.userId, REAL_PAINT_ID);
    expect(entry?.isWishlisted).toBe(true);
    expect(entry?.ownedCount).toBe(0);
  });

  test("updateWishlistItem changing status on a linked row also reflects", async () => {
    const { linkedItem } = await reconcilePaintOwnership(state.userId, REAL_PAINT_ID, "WISHLIST");

    const res = await updateWishlistItem({ id: linkedItem!.id, status: "OWNED" });
    expect(res.ok).toBe(true);

    const entry = await getInventoryEntry(state.userId, REAL_PAINT_ID);
    expect(entry?.isWishlisted).toBe(false);
    expect(entry?.ownedCount).toBeGreaterThan(0);
  });

  test("updateWishlistItem editing price only (no status) does NOT touch inventory_entry", async () => {
    await reconcilePaintOwnership(state.userId, REAL_PAINT_ID, "OWNED");
    const before = await getInventoryEntry(state.userId, REAL_PAINT_ID);

    const linkedItem = (await linkedRowsFor(REAL_PAINT_ID))[0]!;
    const res = await updateWishlistItem({ id: linkedItem.id, price: 12.5 });
    expect(res.ok).toBe(true);

    const after = await getInventoryEntry(state.userId, REAL_PAINT_ID);
    expect(after?.ownedCount).toBe(before?.ownedCount);
    expect(after?.isWishlisted).toBe(before?.isWishlisted);
  });

  test("deleting a linked row clears inventory_entry flags", async () => {
    const { linkedItem } = await reconcilePaintOwnership(state.userId, REAL_PAINT_ID, "OWNED");

    const res = await deleteWishlistItem({ id: linkedItem!.id });
    expect(res.ok).toBe(true);

    const entry = await getInventoryEntry(state.userId, REAL_PAINT_ID);
    expect(entry?.ownedCount).toBe(0);
    expect(entry?.isWishlisted).toBe(false);
  });

  test("deleting an unlinked (manually-typed) row does not touch inventory_entry for any paint", async () => {
    const created = await state
      .db!.insert(wishlistItems)
      .values({ ownerId: state.userId, kind: "paint", title: "Hand-typed paint" })
      .returning();

    const res = await deleteWishlistItem({ id: created[0]!.id });
    expect(res.ok).toBe(true);

    const allInventory = await state.db!.select().from(inventoryEntries);
    expect(allInventory).toHaveLength(0);
  });
});

describe("listLinkedPaintStatuses", () => {
  test("surfaces OWNED/WISHLIST but not HOLD", async () => {
    await reconcilePaintOwnership(state.userId, REAL_PAINT_ID, "OWNED");
    const secondPaintId = "14558";
    await reconcilePaintOwnership(state.userId, secondPaintId, "WISHLIST");

    const map = await listLinkedPaintStatuses(state.userId);
    expect(map.get(REAL_PAINT_ID)).toBe("OWNED");
    expect(map.get(secondPaintId)).toBe("WISHLIST");
  });
});
