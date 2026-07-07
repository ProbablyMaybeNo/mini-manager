import { describe, expect, test } from "vitest";
import { fillHarmonyHexes, harmonySlotHsl } from "@/lib/tools/wheel/schemeFill";
import { hslToHex } from "@/lib/tools/wheel/harmonies";

const SEED = { h: 200, s: 80, l: 50 };

describe("harmonySlotHsl", () => {
  test("index 0 is always the seed unchanged, for every harmony", () => {
    const harmonies = [
      "complementary",
      "analogous",
      "triadic",
      "tetradic",
      "splitComplementary",
      "square",
      "monochromatic",
      "accentedAnalogous",
    ] as const;
    for (const h of harmonies) {
      expect(harmonySlotHsl(h, SEED, 0)).toEqual(SEED);
    }
  });

  test("complementary alternates seed / opposite hue every slot", () => {
    const a = harmonySlotHsl("complementary", SEED, 1);
    expect(a.h).toBe(20); // 200 + 180, wrapped
    const b = harmonySlotHsl("complementary", SEED, 2);
    expect(b).toEqual(SEED); // cycles back to the seed at index 2
  });

  test("cycles past the harmony's natural swatch count instead of stopping", () => {
    // triadic has 3 canonical steps; index 3 should repeat index 0's pattern.
    const i0 = harmonySlotHsl("triadic", SEED, 0);
    const i3 = harmonySlotHsl("triadic", SEED, 3);
    expect(i3).toEqual(i0);
  });

  test("monochromatic varies lightness, holds hue", () => {
    const step = harmonySlotHsl("monochromatic", SEED, 1);
    expect(step.h).toBe(SEED.h);
    expect(step.l).toBe(25); // 50 - 25
  });

  test("lightness clamps to the 6–94 floor/ceiling", () => {
    const dark = harmonySlotHsl("monochromatic", { h: 0, s: 50, l: 10 }, 1); // -25 → -15, clamps to 6
    expect(dark.l).toBe(6);
    const light = harmonySlotHsl("monochromatic", { h: 0, s: 50, l: 90 }, 4); // +25 → 115, clamps to 94
    expect(light.l).toBe(94);
  });
});

describe("fillHarmonyHexes", () => {
  test("returns exactly `count` hexes, seed first", () => {
    const hexes = fillHarmonyHexes("triadic", SEED, 5);
    expect(hexes).toHaveLength(5);
    expect(hexes[0]).toBe(hslToHex(SEED.h, SEED.s, SEED.l));
  });

  test("handles a count smaller than the harmony's natural swatch count", () => {
    expect(fillHarmonyHexes("tetradic", SEED, 1)).toEqual([
      hslToHex(SEED.h, SEED.s, SEED.l),
    ]);
  });

  test("handles a count larger than the harmony's natural swatch count", () => {
    const hexes = fillHarmonyHexes("complementary", SEED, 6);
    expect(hexes).toHaveLength(6);
    // Even indices are the seed, odd indices are the opposite hue.
    expect(hexes[0]).toBe(hexes[2]);
    expect(hexes[2]).toBe(hexes[4]);
    expect(hexes[1]).toBe(hexes[3]);
    expect(hexes[3]).toBe(hexes[5]);
  });
});
