import { describe, expect, test } from "vitest";
import { filterPaints, hasActiveFilter } from "@/mock/filterPaints";
import { EMPTY_LIBRARY_FILTER, type LibraryFilter, type Paint } from "@/lib/types";

const p = (overrides: Partial<Paint>): Paint => ({
  id: "p1",
  name: "Paint",
  brand: "Citadel",
  line: "Base",
  hex: "#0E4A8A",
  type: "Acrylic",
  sku: "",
  owned: false,
  wishlisted: false,
  ...overrides,
});

const filter = (overrides: Partial<LibraryFilter>): LibraryFilter => ({
  ...EMPTY_LIBRARY_FILTER,
  ...overrides,
});

describe("hasActiveFilter", () => {
  test("false for the empty filter", () => {
    expect(hasActiveFilter(EMPTY_LIBRARY_FILTER)).toBe(false);
  });

  test("true for each narrowing axis", () => {
    expect(hasActiveFilter(filter({ brands: ["Citadel"] }))).toBe(true);
    expect(hasActiveFilter(filter({ types: ["Wash"] }))).toBe(true);
    expect(hasActiveFilter(filter({ colors: ["RED"] }))).toBe(true);
    expect(hasActiveFilter(filter({ status: ["owned"] }))).toBe(true);
    expect(hasActiveFilter(filter({ search: "blue" }))).toBe(true);
    expect(hasActiveFilter(filter({ hex: "#ff0000" }))).toBe(true);
  });

  test("blank search / hex do not count as active", () => {
    expect(hasActiveFilter(filter({ search: "   ", hex: "" }))).toBe(false);
  });
});

describe("filterPaints ordering", () => {
  const list = [
    p({ id: "blue", brand: "Vallejo", hex: "#0E4A8A" }),
    p({ id: "red", brand: "Citadel", hex: "#FF3333" }),
    p({ id: "yellow", brand: "Army Painter", hex: "#FFCC33" }),
  ];

  test("unfiltered: preserves the catalog's incoming (brand) order", () => {
    expect(filterPaints(list, EMPTY_LIBRARY_FILTER).map((x) => x.id)).toEqual([
      "blue",
      "red",
      "yellow",
    ]);
  });

  test("any active filter: defaults to a colour walk (hue ascending)", () => {
    // A type filter that keeps every paint still flips the order to hue.
    const sorted = filterPaints(list, filter({ types: ["Acrylic"] })).map((x) => x.id);
    expect(sorted).toEqual(["red", "yellow", "blue"]);
  });

  test("does not mutate the input array", () => {
    filterPaints(list, filter({ types: ["Acrylic"] }));
    expect(list.map((x) => x.id)).toEqual(["blue", "red", "yellow"]);
  });
});
