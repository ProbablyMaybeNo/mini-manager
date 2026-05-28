import { describe, expect, test } from "vitest";
import {
  deltaE2000,
  deltaE2000Hex,
  hexToLab,
  hexToRgb01,
} from "@/lib/tools/match/deltaE";
import {
  classifyConfidence,
  findClosestPaints,
} from "@/lib/tools/match/find";
import type { Paint } from "@/lib/paints/types";

describe("hexToRgb01", () => {
  test("parses #RRGGBB", () => {
    expect(hexToRgb01("#FF0000")).toEqual({ r: 1, g: 0, b: 0 });
  });
  test("parses #RGB shorthand", () => {
    expect(hexToRgb01("#F00")).toEqual({ r: 1, g: 0, b: 0 });
  });
  test("returns null for malformed input", () => {
    expect(hexToRgb01("not-a-hex")).toBeNull();
    expect(hexToRgb01("#GGGGGG")).toBeNull();
  });
});

describe("hexToLab — sRGB → Lab (D65)", () => {
  test("pure white", () => {
    const lab = hexToLab("#FFFFFF")!;
    expect(lab.L).toBeCloseTo(100, 1);
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });
  test("pure black", () => {
    const lab = hexToLab("#000000")!;
    expect(lab.L).toBeCloseTo(0, 1);
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });
  test("pure red — published reference", () => {
    // sRGB #FF0000 → Lab ≈ (53.24, 80.09, 67.20)
    const lab = hexToLab("#FF0000")!;
    expect(lab.L).toBeCloseTo(53.24, 0);
    expect(lab.a).toBeCloseTo(80.09, 0);
    expect(lab.b).toBeCloseTo(67.2, 0);
  });
});

/**
 * Subset of the 34 published CIEDE2000 reference pairs from
 * Sharma, Wu & Dalal (2005), "The CIEDE2000 Color-Difference Formula:
 * Implementation Notes, Supplementary Test Data, and Mathematical
 * Observations" — Table 1. Our implementation should match each
 * expected ΔE to within 0.01.
 */
describe("deltaE2000 — Sharma reference pairs", () => {
  const pairs: ReadonlyArray<{
    name: string;
    a: { L: number; a: number; b: number };
    b: { L: number; a: number; b: number };
    expected: number;
  }> = [
    {
      name: "Pair 1 — neutral",
      a: { L: 50, a: 2.6772, b: -79.7751 },
      b: { L: 50, a: 0.0, b: -82.7485 },
      expected: 2.0425,
    },
    {
      name: "Pair 2",
      a: { L: 50, a: 3.1571, b: -77.2803 },
      b: { L: 50, a: 0.0, b: -82.7485 },
      expected: 2.8615,
    },
    {
      name: "Pair 4",
      a: { L: 50, a: -1.3802, b: -84.2814 },
      b: { L: 50, a: 0.0, b: -82.7485 },
      expected: 1.0,
    },
    {
      name: "Pair 9 — hue rotation around 0",
      a: { L: 50, a: 2.5, b: 0.0 },
      b: { L: 73, a: 25, b: -18 },
      expected: 27.1492,
    },
    {
      name: "Pair 14 — identical",
      a: { L: 60.2574, a: -34.0099, b: 36.2677 },
      b: { L: 60.4626, a: -34.1751, b: 39.4387 },
      expected: 1.2644,
    },
    {
      name: "Pair 16",
      a: { L: 22.7233, a: 20.0904, b: -46.694 },
      b: { L: 23.0331, a: 14.973, b: -42.5619 },
      expected: 2.0373,
    },
    {
      name: "Pair 17",
      a: { L: 36.4612, a: 47.858, b: 18.3852 },
      b: { L: 36.2715, a: 50.5065, b: 21.2231 },
      expected: 1.4146,
    },
  ];
  for (const p of pairs) {
    test(p.name, () => {
      const d = deltaE2000(p.a, p.b);
      expect(Math.abs(d - p.expected)).toBeLessThan(0.01);
    });
  }
});

describe("deltaE2000Hex", () => {
  test("identical hex has ΔE 0", () => {
    expect(deltaE2000Hex("#0E4A8A", "#0E4A8A")).toBeCloseTo(0, 6);
  });
  test("malformed input returns Infinity", () => {
    expect(deltaE2000Hex("nope", "#FFFFFF")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("classifyConfidence", () => {
  test("under 2 is high", () => {
    expect(classifyConfidence(0.5)).toBe("high");
  });
  test("under 5 is medium", () => {
    expect(classifyConfidence(3.5)).toBe("medium");
  });
  test("5 and above is low", () => {
    expect(classifyConfidence(5)).toBe("low");
    expect(classifyConfidence(99)).toBe("low");
  });
});

describe("findClosestPaints", () => {
  const paints: ReadonlyArray<Paint> = [
    {
      id: "p1",
      brand: "Citadel",
      name: "Macragge Blue",
      type: "Paint",
      hex: "#0E4A8A",
      hexConfidence: "high",
      hexSource: "test",
      sourceUrl: "",
    },
    {
      id: "p2",
      brand: "Vallejo",
      name: "Imperial Blue",
      type: "Paint",
      hex: "#0F4B8C",
      hexConfidence: "medium",
      hexSource: "test",
      sourceUrl: "",
    },
    {
      id: "p3",
      brand: "Vallejo",
      name: "Bright Yellow",
      type: "Paint",
      hex: "#FFD500",
      hexConfidence: "medium",
      hexSource: "test",
      sourceUrl: "",
    },
  ];

  test("returns closest first", () => {
    const out = findClosestPaints("#0E4A8A", paints);
    expect(out[0]?.paint.id).toBe("p1");
    expect(out[0]?.deltaE).toBeCloseTo(0, 4);
    expect(out[1]?.paint.id).toBe("p2");
    expect(out[2]?.paint.id).toBe("p3");
  });

  test("brand filter excludes other brands", () => {
    const out = findClosestPaints("#0E4A8A", paints, { brands: ["Vallejo"] });
    expect(out.map((r) => r.paint.brand)).toEqual(["Vallejo", "Vallejo"]);
  });

  test("limit caps result count", () => {
    const out = findClosestPaints("#0E4A8A", paints, { limit: 1 });
    expect(out).toHaveLength(1);
  });

  test("malformed target returns empty", () => {
    expect(findClosestPaints("nope", paints)).toEqual([]);
  });
});
