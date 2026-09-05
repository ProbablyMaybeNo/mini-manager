/**
 * Wishlist kind heuristic — inferWishlistKind(title, vendor, category).
 *
 * REWRITTEN 2026-09-05. The old suite asserted that a model-retailer vendor
 * won "even on a paint-sounding title", which is precisely the bug: every
 * Citadel paint bought from Element Games or Wayland was filed as a model,
 * with `category: "Paint"` sitting right there in the same call. Those
 * assertions are inverted below and kept, because re-introducing them is the
 * regression to guard against.
 *
 * The suite no longer claims to pin the `0007_wishlist_phase12_rename.sql`
 * backfill. That migration has run and is historical; the runtime rules
 * deliberately diverge from it now.
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

describe("inferWishlistKind — category beats vendor (the 2026-09-05 fix)", () => {
  // These four are the exact rows the extension was mis-filing. The vendor is
  // a miniatures retailer AND the category says Paint — evidence about the
  // product must beat a prior about the shop.
  test("a paint from a model retailer is a PAINT when the category says so", () => {
    expect(
      inferWishlistKind({
        title: "Air: Abaddon Black (24ml) - Citadel Games Workshop Paints",
        vendor: "Element Games",
        category: "Paint",
      }),
    ).toBe("paint");
    expect(
      inferWishlistKind({
        title: "Base: Macragge Blue (12ml)",
        vendor: "Element Games",
        category: "Paint",
      }),
    ).toBe("paint");
    expect(
      inferWishlistKind({
        title: "Citadel Shade: Nuln Oil",
        vendor: "Wayland Games",
        category: "Paint",
      }),
    ).toBe("paint");
    expect(
      inferWishlistKind({
        title: "Warpaints Fanatic: Dragon Red - The Army Painter",
        vendor: "Wayland Games",
        category: "Paint",
      }),
    ).toBe("paint");
  });

  test("a box from the same retailer is still a MODEL", () => {
    expect(
      inferWishlistKind({
        title: "Space Marines Combat Patrol",
        vendor: "Element Games",
        category: "Box",
      }),
    ).toBe("model");
  });

  // "The Army Painter" is a PAINT BRAND containing the model word "army".
  // Substring matching made every one of its products a model, from any
  // vendor, with no category at all.
  test("a paint brand whose name contains a model word is still a PAINT", () => {
    expect(
      inferWishlistKind({ title: "Warpaints Fanatic: Dragon Red - The Army Painter" }),
    ).toBe("paint");
    expect(
      inferWishlistKind({ title: "The Army Painter Speedpaint 2.0: Blood Red" }),
    ).toBe("paint");
  });
});

describe("inferWishlistKind — vendor as a last-resort prior", () => {
  test("model-retailer vendor still wins when nothing else says anything", () => {
    expect(
      inferWishlistKind({ title: "Ancient Ruins Sprue", vendor: "Element Games" }),
    ).toBe("model");
    expect(
      inferWishlistKind({ title: "Gnarlwood Scenery Bundle", vendor: "Wayland Games" }),
    ).toBe("model");
  });

  test("a vendor that isn't a model retailer doesn't trip it", () => {
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

  test("'Bits' → 'model' (conversion parts are not paint)", () => {
    expect(
      inferWishlistKind({ title: "Chaos Warrior Shields", category: "Bits" }),
    ).toBe("model");
  });

  test("an explicit 'Paint' category outranks a model word in the title", () => {
    expect(
      inferWishlistKind({ title: "Army Painter Terrain Primer", category: "Paint" }),
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

describe("Wishlist schema — status + kind vocabulary", () => {
  test("wishlistStatuses union covers paint + model collection sets", async () => {
    // COLLECTIONS rebuild widened the union to the UNION of the paint set
    // (WISHLIST/OWNED/HOLD) and the model lifecycle (WISHLIST/OWNED/BUILT/
    // PRIMED/PAINTED/BASED/COMPLETE), keeping legacy PURCHASED for old rows.
    const { wishlistStatuses } = await import("@/db/schema");
    expect([...wishlistStatuses].sort()).toEqual(
      [
        "BASED",
        "BUILT",
        "COMPLETE",
        "HOLD",
        "OWNED",
        "PAINTED",
        "PRIMED",
        "PURCHASED",
        "WISHLIST",
      ].sort(),
    );
  });

  test("per-kind status subsets are the picker sets", async () => {
    const { paintCollectionStatuses, modelCollectionStatuses } = await import(
      "@/db/schema"
    );
    expect([...paintCollectionStatuses]).toEqual(["WISHLIST", "OWNED", "HOLD"]);
    expect([...modelCollectionStatuses]).toEqual([
      "WISHLIST",
      "OWNED",
      "BUILT",
      "PRIMED",
      "PAINTED",
      "BASED",
      "COMPLETE",
    ]);
  });

  test("wishlistKinds union is exactly 'paint' | 'model'", async () => {
    const { wishlistKinds } = await import("@/db/schema");
    expect([...wishlistKinds].sort()).toEqual(["model", "paint"].sort());
  });
});
