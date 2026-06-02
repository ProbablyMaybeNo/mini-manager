/**
 * P16.2 — coverage query + server read for the heat-sink grid.
 *
 * Pins:
 *   getInventoryByPaintId(userId)
 *     → Map<paintId, {ownedCount, isWishlisted}> from a single indexed
 *       read; user-scoped; absent paints simply aren't in the map.
 *   composeCoverageGrid(paints, inventory)
 *     → hue-sorted cells + per-cell coverage state + header summary.
 *
 * Integration-level: getInventoryByPaintId runs against a real
 * in-memory libsql DB; the compose join is exercised end-to-end from
 * the query output so the buckets + summary are pinned together.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { inventoryEntries, users } from "@/db/schema";
import type { Paint } from "@/lib/paints/types";
import type { CoverageGrid } from "@/db/queries/paintCoverage";

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

const {
  getInventoryByPaintId,
  composeCoverageGrid,
  getDefaultBrandFilter,
  brandsInGrid,
} = await import("@/db/queries/paintCoverage");

const p = (id: string, hex: string): Paint => ({
  id,
  brand: "Citadel",
  line: "Base",
  name: id,
  type: "Paint",
  hex,
  hexConfidence: "high",
  hexSource: "stahly",
  sourceUrl: "https://example.com",
});

async function seedInventory(
  paintId: string,
  ownedCount: number,
  isWishlisted: boolean,
  ownerId?: string,
): Promise<void> {
  await state.db!.insert(inventoryEntries).values({
    ownerId: ownerId ?? state.userId,
    paintId,
    ownedCount,
    isWishlisted,
  });
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

describe("getInventoryByPaintId", () => {
  test("empty map when the painter has no inventory", async () => {
    const map = await getInventoryByPaintId(state.userId);
    expect(map.size).toBe(0);
  });

  test("projects owned + wishlisted rows keyed by paintId", async () => {
    await seedInventory("citadel-mephiston-red", 3, false);
    await seedInventory("citadel-abaddon-black", 0, true);
    const map = await getInventoryByPaintId(state.userId);
    expect(map.size).toBe(2);
    expect(map.get("citadel-mephiston-red")).toEqual({
      ownedCount: 3,
      isWishlisted: false,
    });
    expect(map.get("citadel-abaddon-black")).toEqual({
      ownedCount: 0,
      isWishlisted: true,
    });
  });

  test("is scoped to the calling user", async () => {
    const other = await seedExtraUser(state.db!);
    await seedInventory("mine", 1, false);
    await seedInventory("theirs", 9, false, other);
    const map = await getInventoryByPaintId(state.userId);
    expect(map.has("mine")).toBe(true);
    expect(map.has("theirs")).toBe(false);
  });
});

describe("getCoverageGrid composition", () => {
  const paints: Paint[] = [
    p("red", "#ff0000"),
    p("green", "#00ff00"),
    p("blue", "#0000ff"),
    p("grey", "#808080"),
  ];

  test("user with 0 inventory → every cell 'none', summary zeroed", async () => {
    const inventory = await getInventoryByPaintId(state.userId);
    const grid = composeCoverageGrid(paints, inventory);
    expect(grid.cells).toHaveLength(4);
    expect(grid.cells.every((c) => c.state === "none")).toBe(true);
    expect(grid.summary).toEqual({
      owned: 0,
      wanted: 0,
      total: 4,
      ownedPct: 0,
    });
  });

  test("mixed owned + wishlisted → correct buckets + summary", async () => {
    await seedInventory("red", 2, false); // owned
    await seedInventory("green", 0, true); // wanted
    await seedInventory("blue", 1, true); // owned (owned beats wanted)
    // grey: untouched → none
    const inventory = await getInventoryByPaintId(state.userId);
    const grid = composeCoverageGrid(paints, inventory);

    const stateById = new Map(
      grid.cells.map((c) => [c.paint.id, c.state] as const),
    );
    expect(stateById.get("red")).toBe("owned");
    expect(stateById.get("green")).toBe("wanted");
    expect(stateById.get("blue")).toBe("owned");
    expect(stateById.get("grey")).toBe("none");

    expect(grid.summary.owned).toBe(2);
    expect(grid.summary.wanted).toBe(1);
    expect(grid.summary.total).toBe(4);
    expect(grid.summary.ownedPct).toBe(50); // 2 / 4
  });

  test("cells are hue-sorted — chromatic spectrum first, grey at the end", async () => {
    const inventory = await getInventoryByPaintId(state.userId);
    const grid = composeCoverageGrid(paints, inventory);
    const order = grid.cells.map((c) => c.paint.id);
    expect(order).toEqual(["red", "green", "blue", "grey"]);
  });
});

describe("getDefaultBrandFilter (P16.4)", () => {
  test("null when the painter has no saved filter", async () => {
    const filter = await getDefaultBrandFilter(state.userId);
    expect(filter).toBeNull();
  });

  test("decodes the painter's saved library_brand_filter array", async () => {
    await state.db!
      .update(users)
      .set({ libraryBrandFilter: JSON.stringify(["Citadel", "Vallejo"]) })
      .where(eq(users.id, state.userId));
    const filter = await getDefaultBrandFilter(state.userId);
    expect(filter).toEqual(["Citadel", "Vallejo"]);
  });

  test("malformed JSON decodes to null (all brands)", async () => {
    await state.db!
      .update(users)
      .set({ libraryBrandFilter: "{not json" })
      .where(eq(users.id, state.userId));
    const filter = await getDefaultBrandFilter(state.userId);
    expect(filter).toBeNull();
  });

  test("is scoped to the calling user", async () => {
    const other = await seedExtraUser(state.db!);
    await state.db!
      .update(users)
      .set({ libraryBrandFilter: JSON.stringify(["Army Painter"]) })
      .where(eq(users.id, other));
    const mine = await getDefaultBrandFilter(state.userId);
    expect(mine).toBeNull();
  });
});

describe("brandsInGrid (P16.4)", () => {
  test("distinct brands across cells, sorted", () => {
    const grid: CoverageGrid = {
      cells: [
        { paint: p("a", "#ff0000"), state: "none" },
        { paint: { ...p("b", "#00ff00"), brand: "Vallejo" }, state: "none" },
        { paint: { ...p("c", "#0000ff"), brand: "Army Painter" }, state: "none" },
        { paint: { ...p("d", "#808080"), brand: "Vallejo" }, state: "none" },
      ],
      summary: { owned: 0, wanted: 0, total: 4, ownedPct: 0 },
    };
    expect(brandsInGrid(grid)).toEqual(["Army Painter", "Citadel", "Vallejo"]);
  });

  test("empty grid → empty brand list", () => {
    const grid: CoverageGrid = {
      cells: [],
      summary: { owned: 0, wanted: 0, total: 0, ownedPct: 0 },
    };
    expect(brandsInGrid(grid)).toEqual([]);
  });
});
