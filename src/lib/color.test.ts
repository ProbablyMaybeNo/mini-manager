import { describe, expect, it } from "vitest";
import { harmonies, hexToHsl, hslToHex, ramp, readableText } from "./color";
import { filterPaints, COLOR_OPTIONS } from "@/mock/filterPaints";
import type { LibraryFilter, Paint } from "./types";

const paint = (over: Partial<Paint>): Paint => ({
  id: "x",
  name: "n",
  brand: "Citadel",
  line: "Base",
  hex: "#ff0000",
  type: "Acrylic",
  sku: "1",
  owned: false,
  wishlisted: false,
  ...over,
});

describe("color maths", () => {
  it("hslToHex round-trips a primary", () => {
    const [h, s, l] = hexToHsl("#ff0000");
    expect(Math.round(h)).toBe(0);
    expect(hslToHex(h, s, l)).toBe("#ff0000");
  });

  it("complementary harmony returns base + opposite", () => {
    expect(harmonies("#ff0000", "Complementary")).toHaveLength(2);
  });

  it("ramp produces the requested step count", () => {
    expect(ramp("#000000", "#ffffff", 5)).toHaveLength(5);
  });

  it("readableText picks contrasting foreground", () => {
    expect(readableText("#ffffff")).toBe("#000000");
    expect(readableText("#0d407f")).toBe("#ffffff");
  });
});

describe("filterPaints", () => {
  const pool = [
    paint({ id: "r", hex: "#ff0000", brand: "Citadel", owned: true }),
    paint({ id: "b", hex: "#0000ff", brand: "Vallejo", wishlisted: true }),
  ];
  const base: LibraryFilter = { colors: [], brands: [], status: [], search: "", hex: "" };

  it("filters by brand", () => {
    const out = filterPaints(pool, { ...base, brands: ["Vallejo"] });
    expect(out.map((p) => p.id)).toEqual(["b"]);
  });

  it("filters by owned status", () => {
    expect(filterPaints(pool, { ...base, status: ["owned"] }).map((p) => p.id)).toEqual(["r"]);
  });

  it("filters by colour family", () => {
    expect(COLOR_OPTIONS).toContain("RED");
    const out = filterPaints(pool, { ...base, colors: ["RED"] });
    expect(out.map((p) => p.id)).toEqual(["r"]);
  });
});
