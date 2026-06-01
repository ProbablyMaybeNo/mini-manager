import { describe, expect, test } from "vitest";
import type { Paint } from "@/lib/paints/types";
import {
  bandForHex,
  closerMatchesDeltaE,
  fastMatchByHueBand,
} from "@/lib/colorPicker/matchPaints";

/* P12.1 — ColorPicker paint-match helpers.
 *
 * Two passes:
 *   - fastMatchByHueBand: cheap categorical filter, used as the
 *     library sub-panel default.
 *   - closerMatchesDeltaE: perceptual sort, hidden behind a "Show
 *     closer matches" button. Defaults to top 20 (Ross's locked
 *     answer).
 *
 * Both are pure functions — fixture paints below, no DB. */

function paint(id: string, hex: string, name = id, brand = "X"): Paint {
  return {
    id,
    brand,
    name,
    type: "Paint",
    hex,
    hexConfidence: "high",
    hexSource: "test",
    sourceUrl: "test://",
  };
}

const FIXTURES: Paint[] = [
  paint("red-1", "#FF0000", "Pure red"),
  paint("red-2", "#E10D17", "Crimson"),
  paint("orange-1", "#FF8800", "Sunset orange"),
  paint("yellow-1", "#FFD700", "Yellow"),
  paint("green-1", "#00CC00", "Green"),
  paint("green-2", "#22AA44", "Forest green"),
  paint("cyan-1", "#00CCCC", "Cyan"),
  paint("blue-1", "#0000FF", "Blue"),
  paint("violet-1", "#7733CC", "Violet"),
  paint("magenta-1", "#DD44AA", "Magenta"),
  paint("white", "#FFFFFF", "White"),
  paint("black", "#101010", "Near black"),
  paint("grey", "#808080", "Mid grey"),
  paint("malformed", "not-a-hex", "Junk"),
];

describe("bandForHex", () => {
  test("returns the correct band for pure primaries", () => {
    expect(bandForHex("#FF0000")).toBe("Red");
    expect(bandForHex("#FFAA00")).toBe("Orange");
    expect(bandForHex("#FFD700")).toBe("Yellow");
    expect(bandForHex("#00CC00")).toBe("Green");
    expect(bandForHex("#00CCCC")).toBe("Cyan");
    expect(bandForHex("#0000FF")).toBe("Blue");
    expect(bandForHex("#7733CC")).toBe("Violet");
    expect(bandForHex("#DD44AA")).toBe("Magenta");
  });

  test("returns null for greyscale picks (no hue)", () => {
    expect(bandForHex("#000000")).toBeNull();
    expect(bandForHex("#808080")).toBeNull();
    expect(bandForHex("#FFFFFF")).toBeNull();
  });

  test("returns null for malformed hex", () => {
    expect(bandForHex("garbage")).toBeNull();
    expect(bandForHex("#zzz")).toBeNull();
    expect(bandForHex("")).toBeNull();
  });
});

describe("fastMatchByHueBand", () => {
  test("returns paints whose hue lands in the same band as the picked hex", () => {
    const out = fastMatchByHueBand("#FF0000", FIXTURES);
    const ids = out.map((p) => p.id);
    expect(ids).toContain("red-1");
    expect(ids).toContain("red-2");
    // Sibling bands are excluded.
    expect(ids).not.toContain("orange-1");
    expect(ids).not.toContain("magenta-1");
  });

  test("skips paints with malformed hex", () => {
    const out = fastMatchByHueBand("#FF0000", FIXTURES);
    const ids = out.map((p) => p.id);
    expect(ids).not.toContain("malformed");
  });

  test("greyscale pick falls back to returning the full pool (capped)", () => {
    const out = fastMatchByHueBand("#808080", FIXTURES, { limit: 5 });
    expect(out.length).toBe(5);
  });

  test("respects the limit option", () => {
    const out = fastMatchByHueBand("#FF0000", FIXTURES, { limit: 1 });
    expect(out.length).toBe(1);
  });

  test("default limit is 50", () => {
    // Build a synthetic catalog of 60 same-band paints
    const reds: Paint[] = Array.from({ length: 60 }, (_, i) =>
      paint(`r${i}`, "#FF0000"),
    );
    const out = fastMatchByHueBand("#FF0000", reds);
    expect(out.length).toBe(50);
  });
});

describe("closerMatchesDeltaE", () => {
  test("ranks closer perceptual matches first", () => {
    // Picking pure red — red-1 (#FF0000) should rank above red-2 (#E10D17)
    // which should rank above orange-1.
    const out = closerMatchesDeltaE("#FF0000", FIXTURES);
    expect(out.length).toBeGreaterThan(0);
    // The first hit must be red-1 itself (deltaE ~ 0).
    expect(out[0]?.paint.id).toBe("red-1");
    // Sorted ascending by deltaE.
    for (let i = 1; i < out.length; i++) {
      const curr = out[i];
      const prev = out[i - 1];
      if (curr && prev) {
        expect(curr.deltaE).toBeGreaterThanOrEqual(prev.deltaE);
      }
    }
  });

  test("default limit is 20", () => {
    const many: Paint[] = Array.from({ length: 50 }, (_, i) =>
      paint(`p${i}`, `#${(i * 5).toString(16).padStart(2, "0")}FF00`),
    );
    const out = closerMatchesDeltaE("#FF0000", many);
    expect(out.length).toBe(20);
  });

  test("explicit limit caps the result count", () => {
    const out = closerMatchesDeltaE("#FF0000", FIXTURES, 3);
    expect(out.length).toBeLessThanOrEqual(3);
  });

  test("malformed target hex returns no results", () => {
    const out = closerMatchesDeltaE("not-a-hex", FIXTURES);
    expect(out).toEqual([]);
  });
});
