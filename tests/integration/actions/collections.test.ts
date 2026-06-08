import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { makeTestDb, type TestDb } from "../_helpers/testDb";

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
vi.mock("@/lib/scrape", () => ({ scrapeUrl: vi.fn() }));

const { createWishlistItem } = await import("@/lib/actions/wishlist");
const {
  listPaintCollection,
  listModelCollection,
  collectionStats,
} = await import("@/db/queries/collections");

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("collection partitioning", () => {
  test("paint vs model rows land in their own collection query", async () => {
    const paint = await createWishlistItem({
      title: "Mephiston Red",
      kind: "paint",
      company: "Citadel",
      paintType: "Acrylic",
    });
    const model = await createWishlistItem({
      title: "Space Marine Tactical Squad",
      kind: "model",
      game: "Warhammer 40k",
      army: "Ultramarines",
    });
    expect(paint.ok && model.ok).toBe(true);

    const paints = await listPaintCollection(state.userId);
    const models = await listModelCollection(state.userId);

    expect(paints.map((p) => p.title)).toContain("Mephiston Red");
    expect(paints.map((p) => p.title)).not.toContain(
      "Space Marine Tactical Squad",
    );
    expect(models.map((m) => m.title)).toContain("Space Marine Tactical Squad");

    // New structured columns round-trip.
    const p = paints.find((x) => x.title === "Mephiston Red");
    expect(p?.company).toBe("Citadel");
    expect(p?.paintType).toBe("Acrylic");
    const m = models.find((x) => x.title === "Space Marine Tactical Squad");
    expect(m?.game).toBe("Warhammer 40k");
    expect(m?.army).toBe("Ultramarines");
  });

  test("paint status filter narrows the paint collection", async () => {
    await createWishlistItem({ title: "Owned paint", kind: "paint", status: "OWNED" });
    await createWishlistItem({ title: "Wanted paint", kind: "paint", status: "WISHLIST" });

    const owned = await listPaintCollection(state.userId, { status: "OWNED" });
    expect(owned.map((p) => p.title)).toEqual(["Owned paint"]);
  });

  test("model status accepts the build lifecycle stages", async () => {
    const res = await createWishlistItem({
      title: "Primed mini",
      kind: "model",
      status: "PRIMED",
    });
    expect(res.ok).toBe(true);
    const models = await listModelCollection(state.userId, { status: "PRIMED" });
    expect(models.map((m) => m.title)).toEqual(["Primed mini"]);
  });
});

describe("collectionStats", () => {
  test("counts owned paints, model stages, and spend per currency", async () => {
    await createWishlistItem({
      title: "Owned paint",
      kind: "paint",
      status: "OWNED",
      price: 4.5,
      currency: "GBP",
    });
    await createWishlistItem({
      title: "Wishlist paint",
      kind: "paint",
      status: "WISHLIST",
      price: 4.5,
      currency: "GBP",
    });
    await createWishlistItem({
      title: "Built mini",
      kind: "model",
      status: "BUILT",
      price: 30,
      currency: "GBP",
    });

    const stats = await collectionStats(state.userId);
    expect(stats.paintsOwned).toBe(1);
    expect(stats.paintsTotal).toBe(2);
    expect(stats.modelsTotal).toBe(1);
    expect(stats.modelsByStatus.BUILT).toBe(1);
    // Spend counts the OWNED paint (4.5) + BUILT model (30), not the
    // wishlist paint. 34.5 GBP.
    expect(stats.spentByCurrency.GBP).toBeCloseTo(34.5, 2);
  });
});
