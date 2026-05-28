import { describe, expect, test } from "vitest";
import {
  HARMONIES,
  accentedAnalogous,
  analogous,
  buildHarmony,
  clampHue,
  complementary,
  getHarmonyMeta,
  harmonyKeys,
  hexToHsl,
  hslToHex,
  monochromatic,
  splitComplementary,
  square,
  tetradic,
  triadic,
} from "@/lib/tools/wheel/harmonies";

/** Pull the hue back out of a hex via the inverse converter. */
function hueOf(hex: string): number {
  const hsl = hexToHsl(hex);
  if (!hsl) throw new Error(`Invalid hex: ${hex}`);
  return clampHue(hsl.h);
}

function approxHue(actual: number, expected: number, tolerance = 1.0): boolean {
  const diff = Math.abs(((actual - expected + 540) % 360) - 180);
  return diff <= tolerance;
}

describe("HSL ↔ hex roundtrip", () => {
  test("primary red round-trips", () => {
    expect(hslToHex(0, 100, 50)).toBe("#FF0000");
    expect(hexToHsl("#FF0000")?.h).toBe(0);
  });
  test("primary green round-trips", () => {
    expect(hslToHex(120, 100, 50)).toBe("#00FF00");
    const hsl = hexToHsl("#00FF00");
    expect(approxHue(hsl?.h ?? -1, 120)).toBe(true);
  });
  test("primary blue round-trips", () => {
    expect(hslToHex(240, 100, 50)).toBe("#0000FF");
    expect(approxHue(hexToHsl("#0000FF")?.h ?? -1, 240)).toBe(true);
  });
  test("invalid hex returns null", () => {
    expect(hexToHsl("not-a-hex")).toBeNull();
    expect(hexToHsl("#GGGGGG")).toBeNull();
  });
  test("3-digit hex expands", () => {
    expect(hexToHsl("#F00")).toEqual(hexToHsl("#FF0000"));
  });
});

describe("complementary", () => {
  test("returns two swatches at +180°", () => {
    const out = complementary(0, 100, 50);
    expect(out).toHaveLength(2);
    expect(approxHue(hueOf(out[0]!), 0)).toBe(true);
    expect(approxHue(hueOf(out[1]!), 180)).toBe(true);
  });
});

describe("analogous", () => {
  test("returns three swatches at -30 / 0 / +30", () => {
    const out = analogous(120, 80, 50);
    expect(out).toHaveLength(3);
    expect(approxHue(hueOf(out[0]!), 120)).toBe(true);
    expect(approxHue(hueOf(out[1]!), 90)).toBe(true);
    expect(approxHue(hueOf(out[2]!), 150)).toBe(true);
  });
});

describe("triadic", () => {
  test("three swatches 120° apart", () => {
    const out = triadic(0, 100, 50);
    expect(out).toHaveLength(3);
    expect(approxHue(hueOf(out[0]!), 0)).toBe(true);
    expect(approxHue(hueOf(out[1]!), 120)).toBe(true);
    expect(approxHue(hueOf(out[2]!), 240)).toBe(true);
  });
});

describe("tetradic", () => {
  test("rectangle: primary + 60° + +180 + +240", () => {
    const out = tetradic(0, 100, 50);
    expect(out).toHaveLength(4);
    expect(approxHue(hueOf(out[0]!), 0)).toBe(true);
    expect(approxHue(hueOf(out[1]!), 60)).toBe(true);
    expect(approxHue(hueOf(out[2]!), 180)).toBe(true);
    expect(approxHue(hueOf(out[3]!), 240)).toBe(true);
  });
});

describe("splitComplementary", () => {
  test("primary + two flanking complements", () => {
    const out = splitComplementary(0, 100, 50);
    expect(out).toHaveLength(3);
    expect(approxHue(hueOf(out[0]!), 0)).toBe(true);
    expect(approxHue(hueOf(out[1]!), 150)).toBe(true);
    expect(approxHue(hueOf(out[2]!), 210)).toBe(true);
  });
});

describe("square", () => {
  test("four hues 90° apart", () => {
    const out = square(0, 100, 50);
    expect(out).toHaveLength(4);
    expect(approxHue(hueOf(out[0]!), 0)).toBe(true);
    expect(approxHue(hueOf(out[1]!), 90)).toBe(true);
    expect(approxHue(hueOf(out[2]!), 180)).toBe(true);
    expect(approxHue(hueOf(out[3]!), 270)).toBe(true);
  });
});

describe("monochromatic", () => {
  test("primary first; five swatches at varied lightness", () => {
    const out = monochromatic(180, 80, 50);
    expect(out).toHaveLength(5);
    // Primary at index 0 is the painter's L*.
    const primary = hexToHsl(out[0]!)!;
    expect(approxHue(primary.h, 180)).toBe(true);
    expect(Math.round(primary.l)).toBeCloseTo(50, 0);
    // All five share the primary hue.
    for (const hex of out) {
      const hsl = hexToHsl(hex)!;
      // Greys lose hue; the clamped ones near L=0/100 may report 0.
      if (Math.abs(hsl.l - 50) < 30) {
        expect(approxHue(hsl.h, 180, 5)).toBe(true);
      }
    }
  });
});

describe("accentedAnalogous", () => {
  test("analogous trio + complement accent", () => {
    const out = accentedAnalogous(60, 80, 50);
    expect(out).toHaveLength(4);
    expect(approxHue(hueOf(out[0]!), 60)).toBe(true);
    expect(approxHue(hueOf(out[1]!), 30)).toBe(true);
    expect(approxHue(hueOf(out[2]!), 90)).toBe(true);
    expect(approxHue(hueOf(out[3]!), 240)).toBe(true);
  });
});

describe("buildHarmony dispatch", () => {
  test("every key returns the same length as its metadata", () => {
    for (const key of harmonyKeys) {
      const meta = getHarmonyMeta(key);
      const out = buildHarmony(key, 120, 80, 50);
      expect(out).toHaveLength(meta.swatchCount);
    }
  });
  test("HARMONIES metadata stays in sync with the key union", () => {
    expect(HARMONIES.map((h) => h.key).sort()).toEqual(
      [...harmonyKeys].sort(),
    );
  });
});

describe("clampHue", () => {
  test("wraps negatives positive", () => {
    expect(clampHue(-10)).toBe(350);
  });
  test("modulo 360", () => {
    expect(clampHue(720)).toBe(0);
    expect(clampHue(540)).toBe(180);
  });
});
