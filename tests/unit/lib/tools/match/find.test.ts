import { describe, expect, test } from "vitest";
import {
  classifyConfidence,
  findClosestPaints,
} from "@/lib/tools/match/find";
import type { Paint } from "@/lib/paints/types";

function paint(over: Partial<Paint> & { id: string; hex: string }): Paint {
  return {
    brand: "Citadel",
    name: "Test",
    type: "Paint",
    hexConfidence: "high",
    hexSource: "test",
    sourceUrl: "",
    ...over,
  };
}

describe("classifyConfidence", () => {
  test("buckets ΔE into high / medium / low at the documented thresholds", () => {
    expect(classifyConfidence(0)).toBe("high");
    expect(classifyConfidence(1.99)).toBe("high");
    expect(classifyConfidence(2)).toBe("medium");
    expect(classifyConfidence(4.99)).toBe("medium");
    expect(classifyConfidence(5)).toBe("low");
    expect(classifyConfidence(40)).toBe("low");
  });
});

describe("findClosestPaints", () => {
  const catalog: Paint[] = [
    paint({ id: "exact", hex: "#0E4A8A", name: "Macragge Blue" }),
    paint({ id: "near", hex: "#0F4B8B", name: "Almost Macragge" }),
    paint({ id: "far", hex: "#FF0000", name: "Mephiston Red", brand: "Citadel" }),
    paint({ id: "vallejo", hex: "#1050A0", name: "Magic Blue", brand: "Vallejo" }),
  ];

  test("returns matches sorted by ΔE ascending, exact first", () => {
    const results = findClosestPaints("#0E4A8A", catalog);
    expect(results[0]!.paint.id).toBe("exact");
    expect(results[0]!.deltaE).toBeCloseTo(0, 5);
    expect(results[0]!.confidence).toBe("high");
    // far red should be last
    expect(results[results.length - 1]!.paint.id).toBe("far");
    // monotonically non-decreasing
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.deltaE).toBeGreaterThanOrEqual(results[i - 1]!.deltaE);
    }
  });

  test("respects the limit option", () => {
    const results = findClosestPaints("#0E4A8A", catalog, { limit: 2 });
    expect(results).toHaveLength(2);
  });

  test("filters by brand", () => {
    const results = findClosestPaints("#0E4A8A", catalog, {
      brands: ["Vallejo"],
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.paint.brand).toBe("Vallejo");
  });

  test("filters by type", () => {
    const mixed: Paint[] = [
      paint({ id: "wash", hex: "#0E4A8A", type: "Wash" }),
      paint({ id: "layer", hex: "#0E4A8A", type: "Paint" }),
    ];
    const results = findClosestPaints("#0E4A8A", mixed, { types: ["Wash"] });
    expect(results).toHaveLength(1);
    expect(results[0]!.paint.type).toBe("Wash");
  });

  test("skips paints with empty or malformed hex", () => {
    const dirty: Paint[] = [
      paint({ id: "good", hex: "#0E4A8A" }),
      paint({ id: "blank", hex: "" }),
      paint({ id: "bad", hex: "#zzz" }),
    ];
    const results = findClosestPaints("#0E4A8A", dirty);
    expect(results.map((r) => r.paint.id)).toEqual(["good"]);
  });

  test("returns an empty array for an unparseable target", () => {
    expect(findClosestPaints("not-a-hex", catalog)).toEqual([]);
  });
});
