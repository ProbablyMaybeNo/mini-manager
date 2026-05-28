import { describe, expect, test } from "vitest";
import { buildRamp } from "@/lib/tools/gradient/interpolate";
import { hexToLab } from "@/lib/tools/match/deltaE";

const SHADOW = "#072547";
const BASE = "#0E4A8A";
const HIGHLIGHT = "#4A9EFF";

describe("buildRamp anchors", () => {
  test("3-step: shadow / base / highlight", () => {
    const out = buildRamp({ shadow: SHADOW, base: BASE, highlight: HIGHLIGHT, steps: 3 });
    expect(out).toHaveLength(3);
    expect(out[0]).toBe(SHADOW);
    expect(out[1]).toBe(BASE);
    expect(out[2]).toBe(HIGHLIGHT);
  });

  test("5-step: base lands at the middle index", () => {
    const out = buildRamp({ shadow: SHADOW, base: BASE, highlight: HIGHLIGHT, steps: 5 });
    expect(out).toHaveLength(5);
    expect(out[0]).toBe(SHADOW);
    expect(out[2]).toBe(BASE);
    expect(out[4]).toBe(HIGHLIGHT);
  });

  test("7-step: anchors stay pinned", () => {
    const out = buildRamp({ shadow: SHADOW, base: BASE, highlight: HIGHLIGHT, steps: 7 });
    expect(out).toHaveLength(7);
    expect(out[0]).toBe(SHADOW);
    expect(out[3]).toBe(BASE);
    expect(out[6]).toBe(HIGHLIGHT);
  });

  test("increasing step count never moves the anchors", () => {
    const r3 = buildRamp({ shadow: SHADOW, base: BASE, highlight: HIGHLIGHT, steps: 3 });
    const r5 = buildRamp({ shadow: SHADOW, base: BASE, highlight: HIGHLIGHT, steps: 5 });
    const r7 = buildRamp({ shadow: SHADOW, base: BASE, highlight: HIGHLIGHT, steps: 7 });
    expect(r3[0]).toBe(r5[0]);
    expect(r3[0]).toBe(r7[0]);
    expect(r3[r3.length - 1]).toBe(r5[r5.length - 1]);
    expect(r3[r3.length - 1]).toBe(r7[r7.length - 1]);
  });
});

describe("buildRamp monotonicity", () => {
  test("L* increases monotonically shadow → highlight (5 steps)", () => {
    const out = buildRamp({ shadow: SHADOW, base: BASE, highlight: HIGHLIGHT, steps: 5 });
    let prev = -Infinity;
    for (const hex of out) {
      const lab = hexToLab(hex)!;
      expect(lab.L).toBeGreaterThanOrEqual(prev - 0.01);
      prev = lab.L;
    }
  });

  test("L* increases monotonically shadow → highlight (7 steps)", () => {
    const out = buildRamp({ shadow: SHADOW, base: BASE, highlight: HIGHLIGHT, steps: 7 });
    let prev = -Infinity;
    for (const hex of out) {
      const lab = hexToLab(hex)!;
      expect(lab.L).toBeGreaterThanOrEqual(prev - 0.01);
      prev = lab.L;
    }
  });
});

describe("buildRamp guards", () => {
  test("malformed input returns []", () => {
    expect(
      buildRamp({ shadow: "?", base: BASE, highlight: HIGHLIGHT, steps: 5 }),
    ).toEqual([]);
  });

  test("step count clamps to [3, 7]", () => {
    expect(
      buildRamp({ shadow: SHADOW, base: BASE, highlight: HIGHLIGHT, steps: 2 }),
    ).toHaveLength(3);
    expect(
      buildRamp({ shadow: SHADOW, base: BASE, highlight: HIGHLIGHT, steps: 99 }),
    ).toHaveLength(7);
  });
});
