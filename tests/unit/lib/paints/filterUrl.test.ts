import { describe, expect, test } from "vitest";
import {
  filterFromSearchParams,
  sortFromSearchParams,
  selectedPaintFromSearchParams,
  writeFilterToParams,
} from "@/lib/paints/filterUrl";

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("filterFromSearchParams", () => {
  test("parses CSV multi-selects, splitting and trimming", () => {
    const f = filterFromSearchParams(params("brand=Citadel,%20Vallejo&line=Layer"));
    expect(f.brands).toEqual(["Citadel", "Vallejo"]);
    expect(f.lines).toEqual(["Layer"]);
  });

  test("drops type values that are not valid PaintTypes", () => {
    const f = filterFromSearchParams(params("type=Wash,Bogus,Contrast"));
    expect(f.types).toEqual(["Wash", "Contrast"]);
  });

  test("reads the owned flag only when exactly '1'", () => {
    expect(filterFromSearchParams(params("owned=1")).ownedOnly).toBe(true);
    expect(filterFromSearchParams(params("owned=true")).ownedOnly).toBe(false);
    expect(filterFromSearchParams(params("")).ownedOnly).toBe(false);
  });

  test("returns empty arrays and strings for an empty query", () => {
    const f = filterFromSearchParams(params(""));
    expect(f).toEqual({
      brands: [],
      lines: [],
      types: [],
      hueBands: [],
      ownedOnly: false,
      hexQuery: "",
      textQuery: "",
    });
  });

  test("reads hex and text queries", () => {
    const f = filterFromSearchParams(params("hex=5a9dd8&q=ultramarines"));
    expect(f.hexQuery).toBe("5a9dd8");
    expect(f.textQuery).toBe("ultramarines");
  });
});

describe("sortFromSearchParams", () => {
  test("returns a valid sort mode", () => {
    expect(sortFromSearchParams(params("sort=hue"))).toBe("hue");
  });

  test("falls back to 'brand' for unknown or missing sort", () => {
    expect(sortFromSearchParams(params("sort=nonsense"))).toBe("brand");
    expect(sortFromSearchParams(params(""))).toBe("brand");
  });
});

describe("selectedPaintFromSearchParams", () => {
  test("returns the paint id or null", () => {
    expect(selectedPaintFromSearchParams(params("paint=abc123"))).toBe("abc123");
    expect(selectedPaintFromSearchParams(params(""))).toBeNull();
  });
});

describe("writeFilterToParams", () => {
  test("writes CSV params and clears them when empty", () => {
    const p = params("");
    writeFilterToParams(p, { brands: ["Citadel", "Vallejo"] });
    expect(p.get("brand")).toBe("Citadel,Vallejo");

    writeFilterToParams(p, { brands: [] });
    expect(p.has("brand")).toBe(false);
  });

  test("toggles the owned flag on and off", () => {
    const p = params("");
    writeFilterToParams(p, { ownedOnly: true });
    expect(p.get("owned")).toBe("1");
    writeFilterToParams(p, { ownedOnly: false });
    expect(p.has("owned")).toBe(false);
  });

  test("clears hex / text params when set to empty string", () => {
    const p = params("hex=abc&q=blue");
    writeFilterToParams(p, { hexQuery: "", textQuery: "" });
    expect(p.has("hex")).toBe(false);
    expect(p.has("q")).toBe(false);
  });

  test("round-trips a full filter through write then read", () => {
    const p = params("");
    writeFilterToParams(p, {
      brands: ["Citadel"],
      lines: ["Layer"],
      types: ["Wash"],
      hueBands: ["Blue"],
      ownedOnly: true,
      hexQuery: "5a9dd8",
      textQuery: "blue",
    });
    const f = filterFromSearchParams(p);
    expect(f).toEqual({
      brands: ["Citadel"],
      lines: ["Layer"],
      types: ["Wash"],
      hueBands: ["Blue"],
      ownedOnly: true,
      hexQuery: "5a9dd8",
      textQuery: "blue",
    });
  });
});
