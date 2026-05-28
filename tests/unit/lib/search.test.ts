import { describe, expect, test } from "vitest";
import { runGlobalSearch } from "@/lib/search";
import type { Paint } from "@/lib/paints/types";
import type { WishlistItem } from "@/db/schema";

const paint = (overrides: Partial<Paint>): Paint => ({
  id: "p1",
  brand: "Citadel",
  line: "Layer",
  name: "Mephiston Red",
  sku: "22-02",
  type: "Paint",
  hex: "#A30E20",
  hexConfidence: "high",
  hexSource: "stahly",
  sourceUrl: "https://example.com",
  ...overrides,
});

const wishlist = (overrides: Partial<WishlistItem>): WishlistItem =>
  ({
    id: "w1",
    ownerId: "u1",
    projectId: null,
    title: "Citadel Mephiston Red 17ml",
    imageUrl: null,
    sourceUrl: null,
    vendor: "Element Games",
    price: null,
    currency: "USD",
    category: "Paint",
    priority: "Medium",
    status: "Wanted",
    notesMd: null,
    scrapedMetadata: null,
    dateAdded: new Date(),
    dateResolved: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as WishlistItem;

describe("runGlobalSearch", () => {
  test("empty query returns empty results", () => {
    expect(runGlobalSearch("", [paint({})], [wishlist({})])).toEqual({
      paints: [],
      wishlist: [],
    });
  });

  test("substring match in paint name scores 100", () => {
    const r = runGlobalSearch("meph", [paint({})], []);
    expect(r.paints).toHaveLength(1);
    expect(r.paints[0]!.score).toBe(100);
  });

  test("matches paint brand, line, and sku as well as name", () => {
    const r = runGlobalSearch("citadel", [paint({})], []);
    expect(r.paints).toHaveLength(1);
  });

  test("matches across wishlist title + vendor", () => {
    const r = runGlobalSearch("element", [], [wishlist({})]);
    expect(r.wishlist).toHaveLength(1);
  });

  test("token-based partial-match scores below substring (60-scaled)", () => {
    // "red foo" — "red" matches the paint name, "foo" doesn't
    const r = runGlobalSearch("red foo", [paint({})], []);
    expect(r.paints).toHaveLength(1);
    expect(r.paints[0]!.score).toBeGreaterThan(0);
    expect(r.paints[0]!.score).toBeLessThan(100);
  });

  test("sorts hits by descending score", () => {
    const exact = paint({ id: "exact", name: "Mephiston Red" });
    const partial = paint({ id: "partial", name: "Red brick" });
    const r = runGlobalSearch("mephiston red", [partial, exact], []);
    expect(r.paints[0]!.item.id).toBe("exact");
    expect(r.paints[1]!.item.id).toBe("partial");
  });

  test("respects the limit param", () => {
    const list = Array.from({ length: 25 }, (_, i) =>
      paint({ id: `p${i}`, name: `Red ${i}` }),
    );
    const r = runGlobalSearch("red", list, [], 5);
    expect(r.paints).toHaveLength(5);
  });
});
