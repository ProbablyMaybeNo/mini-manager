import { describe, expect, test } from "vitest";
import {
  HUE_BANDS,
  applyAllFilters,
  filterByBrand,
  filterByHex,
  filterByHueBand,
  filterByLine,
  filterByOwned,
  filterByText,
  filterByType,
} from "@/lib/paints/filters";
import { EMPTY_FILTER, type Paint } from "@/lib/paints/types";

const paint = (overrides: Partial<Paint> = {}): Paint => ({
  id: "p1",
  brand: "Citadel",
  line: "Base",
  name: "Macragge Blue",
  sku: "21-08",
  type: "Paint",
  hex: "#0E4A8A",
  hexConfidence: "high",
  hexSource: "stahly",
  sourceUrl: "https://example.com/macragge",
  ...overrides,
});

describe("filterByBrand", () => {
  test("empty brand list returns all paints", () => {
    const list = [paint({ brand: "Citadel" }), paint({ id: "p2", brand: "Vallejo" })];
    expect(filterByBrand(list, [])).toEqual(list);
  });
  test("matches selected brand only", () => {
    const list = [paint({ brand: "Citadel" }), paint({ id: "p2", brand: "Vallejo" })];
    expect(filterByBrand(list, ["Vallejo"])).toHaveLength(1);
    expect(filterByBrand(list, ["Vallejo"])[0]!.brand).toBe("Vallejo");
  });
  test("supports multi-brand selection", () => {
    const list = [
      paint({ brand: "Citadel" }),
      paint({ id: "p2", brand: "Vallejo" }),
      paint({ id: "p3", brand: "Scale75" }),
    ];
    expect(filterByBrand(list, ["Citadel", "Scale75"])).toHaveLength(2);
  });
});

describe("filterByLine", () => {
  test("filters paints with matching line, drops paints without a line", () => {
    const list = [
      paint({ line: "Base" }),
      paint({ id: "p2", line: "Layer" }),
      paint({ id: "p3", line: undefined }),
    ];
    expect(filterByLine(list, ["Base"])).toHaveLength(1);
  });
});

describe("filterByType", () => {
  test("filters by single PaintType", () => {
    const list = [paint({ type: "Paint" }), paint({ id: "p2", type: "Wash" })];
    expect(filterByType(list, ["Wash"])).toHaveLength(1);
    expect(filterByType(list, ["Wash"])[0]!.type).toBe("Wash");
  });
});

describe("filterByHueBand", () => {
  test("Blue band catches blue hex; Red band excludes it", () => {
    const blue = paint({ hex: "#0E4A8A" });
    expect(filterByHueBand([blue], ["Blue"])).toHaveLength(1);
    expect(filterByHueBand([blue], ["Red"])).toHaveLength(0);
  });
  test("Red band wraps around 0° — catches pure red AND pure crimson", () => {
    const pureRed = paint({ hex: "#FF0000" });
    const crimson = paint({ id: "p2", hex: "#FA0033" });
    expect(filterByHueBand([pureRed, crimson], ["Red"])).toHaveLength(2);
  });
  test("greyscale paint matches no band", () => {
    const grey = paint({ hex: "#808080" });
    const allBands = HUE_BANDS.map((b) => b.name);
    expect(filterByHueBand([grey], allBands)).toHaveLength(0);
  });
  test("invalid hex never matches a band", () => {
    const bad = paint({ hex: "garbage" });
    expect(filterByHueBand([bad], ["Blue"])).toHaveLength(0);
  });
});

describe("filterByHex", () => {
  test("finds paints within default RGB distance threshold", () => {
    const target = paint({ hex: "#0E4A8A" });
    const close = paint({ id: "p2", hex: "#103F88" });
    const far = paint({ id: "p3", hex: "#FF0000" });
    const result = filterByHex([target, close, far], "#0E4A8A");
    expect(result.map((p) => p.id)).toEqual(["p1", "p2"]);
  });
  test("garbage hex query returns everything (acts as no-op)", () => {
    const list = [paint(), paint({ id: "p2" })];
    expect(filterByHex(list, "not-a-hex")).toEqual(list);
  });
});

describe("filterByText", () => {
  test("matches name, brand, line, sku", () => {
    const list = [
      paint({ name: "Macragge Blue", sku: "21-08" }),
      paint({ id: "p2", brand: "Vallejo", name: "Magic Blue", sku: "72-021" }),
      paint({ id: "p3", brand: "Scale75", name: "Necro Gold", sku: "SC-15" }),
    ];
    expect(filterByText(list, "macragge").map((p) => p.id)).toEqual(["p1"]);
    expect(filterByText(list, "vallejo").map((p) => p.id)).toEqual(["p2"]);
    expect(filterByText(list, "21-08").map((p) => p.id)).toEqual(["p1"]);
  });
  test("empty query returns everything", () => {
    const list = [paint(), paint({ id: "p2" })];
    expect(filterByText(list, "")).toEqual(list);
  });
});

describe("filterByOwned", () => {
  test("ownedOnly=false returns everything regardless of map", () => {
    const list = [paint(), paint({ id: "p2" })];
    expect(filterByOwned(list, false, new Map())).toEqual(list);
  });
  test("ownedOnly=true keeps only paints with count > 0 in map", () => {
    const list = [paint(), paint({ id: "p2" })];
    const owned = new Map([["p1", 2]]);
    expect(filterByOwned(list, true, owned).map((p) => p.id)).toEqual(["p1"]);
  });
});

describe("applyAllFilters — AND composition", () => {
  test("brand AND type AND hex are combined", () => {
    const list = [
      paint({ id: "p1", brand: "Citadel", type: "Paint", hex: "#0E4A8A" }), // blue
      paint({ id: "p2", brand: "Vallejo", type: "Paint", hex: "#0E4A8A" }),
      paint({ id: "p3", brand: "Citadel", type: "Wash", hex: "#0E4A8A" }),
      paint({ id: "p4", brand: "Citadel", type: "Paint", hex: "#FF0000" }), // red
    ];
    const filter = {
      ...EMPTY_FILTER,
      brands: ["Citadel"],
      types: ["Paint"] as const,
      hexQuery: "#0E4A8A",
    };
    const result = applyAllFilters(list, { ...filter, types: [...filter.types] }, new Map());
    expect(result.map((p) => p.id)).toEqual(["p1"]);
  });
});
