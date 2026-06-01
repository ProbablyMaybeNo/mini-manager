/**
 * P12.11 — Wishlist kind heuristic.
 *
 * inferWishlistKind(title, vendor, category) → 'paint' | 'model'.
 * Used by:
 *   - createWishlistItem + createWishlistItemFromScrape so freshly
 *     added rows get a sensible default
 *   - The drizzle migration (0007_wishlist_phase12_rename.sql) as a
 *     one-shot backfill for pre-Phase-12 data
 *
 * Pure helper. These tests pin the rules so the migration + runtime
 * stay in sync.
 */
import { describe, expect, test } from "vitest";
import { inferWishlistKind } from "@/lib/wishlist/kindInference";

describe("inferWishlistKind — title heuristic", () => {
  test("titles with 'kit' / 'box' / 'army' / 'squad' / 'warband' → 'model'", () => {
    expect(inferWishlistKind({ title: "Aeldari Wraith Lords kit" })).toBe("model");
    expect(inferWishlistKind({ title: "Citadel Skeleton Boxset" })).toBe("model");
    expect(inferWishlistKind({ title: "Necron Warriors Army" })).toBe("model");
    expect(inferWishlistKind({ title: "Reiver Squad" })).toBe("model");
    expect(inferWishlistKind({ title: "Beasts of Chaos Warband" })).toBe("model");
  });

  test("titles with 'unit' / 'terrain' / 'tank' / 'character' → 'model'", () => {
    expect(inferWishlistKind({ title: "Tomb Blades Unit" })).toBe("model");
    expect(inferWishlistKind({ title: "Ruined Terrain Set" })).toBe("model");
    expect(inferWishlistKind({ title: "Leman Russ Tank" })).toBe("model");
    expect(inferWishlistKind({ title: "Named Character Mini" })).toBe("model");
  });

  test("case-insensitive — KIT, kit, Kit all match", () => {
    expect(inferWishlistKind({ title: "starter KIT" })).toBe("model");
    expect(inferWishlistKind({ title: "starter Kit" })).toBe("model");
    expect(inferWishlistKind({ title: "STARTER kit" })).toBe("model");
  });
});

describe("inferWishlistKind — vendor heuristic", () => {
  test("model-retailer vendors → 'model' even on a paint-sounding title", () => {
    expect(
      inferWishlistKind({ title: "Citadel Macragge Blue", vendor: "Element Games" }),
    ).toBe("model");
    expect(
      inferWishlistKind({ title: "Vallejo Black", vendor: "Wayland Games" }),
    ).toBe("model");
    expect(
      inferWishlistKind({ title: "Army Painter Red", vendor: "Goblin Gaming" }),
    ).toBe("model");
  });

  test("paint-only vendor doesn't trip the heuristic", () => {
    expect(
      inferWishlistKind({ title: "Citadel Mephiston Red", vendor: "Citadel Online" }),
    ).toBe("paint");
  });
});

describe("inferWishlistKind — category heuristic", () => {
  test("'Box' / 'Terrain' categories → 'model'", () => {
    expect(
      inferWishlistKind({ title: "Generic widget", category: "Box" }),
    ).toBe("model");
    expect(
      inferWishlistKind({ title: "Some hill", category: "Terrain" }),
    ).toBe("model");
  });

  test("'Paint' / 'Other' categories stay 'paint'", () => {
    expect(
      inferWishlistKind({ title: "Mephiston Red", category: "Paint" }),
    ).toBe("paint");
    expect(
      inferWishlistKind({ title: "Misc thing", category: "Other" }),
    ).toBe("paint");
  });
});

describe("inferWishlistKind — default + fallback", () => {
  test("nothing matching → 'paint'", () => {
    expect(inferWishlistKind({ title: "Mephiston Red 12ml" })).toBe("paint");
    expect(inferWishlistKind({ title: "Just a thing" })).toBe("paint");
  });

  test("null / undefined vendor + category are safe", () => {
    expect(
      inferWishlistKind({ title: "Generic", vendor: null, category: null }),
    ).toBe("paint");
    expect(
      inferWishlistKind({ title: "Generic", vendor: undefined, category: undefined }),
    ).toBe("paint");
  });
});

describe("Wishlist schema — Phase-12 status + kind vocabulary", () => {
  test("wishlistStatuses union is exactly Ross's locked set", async () => {
    const { wishlistStatuses } = await import("@/db/schema");
    expect([...wishlistStatuses].sort()).toEqual(
      ["HOLD", "PURCHASED", "WISHLIST"].sort(),
    );
  });

  test("wishlistKinds union is exactly 'paint' | 'model'", async () => {
    const { wishlistKinds } = await import("@/db/schema");
    expect([...wishlistKinds].sort()).toEqual(["model", "paint"].sort());
  });
});
