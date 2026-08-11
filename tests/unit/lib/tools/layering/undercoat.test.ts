import { describe, expect, it } from "vitest";
import {
  GOALS,
  hueBucket,
  PAINT_TYPE_FILTERS,
  recommendUndercoat,
  type Goal,
} from "@/lib/tools/layering/undercoat";

/**
 * The undercoat / glaze recommender — the brain behind the Layering tool's
 * UNDERCOAT section. It shipped with no tests, and the first thing running it
 * for real surfaced a wrong answer (see "temperature goals" below).
 */

/** Hue of a hex, 0–360. Independent of the module's own private helper so a
 *  bug in that helper can't make these assertions agree with it. */
function hueOf(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/** "Is this hue on the cool side of the wheel" — blues/cyans/violets. */
const isCool = (h: number) => h >= 160 && h <= 290;
/** Warm side — reds, oranges, yellows. */
const isWarm = (h: number) => h < 70 || h > 330;

const DESERT_KHAKI = "#BA9029"; // Sand Golem · The Army Painter (Contrast)
const BLUE = "#2B5FA8";
const GREEN = "#3F8F4A";

describe("recommendUndercoat — temperature goals reach the pole", () => {
  /**
   * REGRESSION. `towardHue` capped rotation at 70°, so a khaki top asked to go
   * COOLER stopped at hue ~113° and returned #35e21d — fluorescent green. The
   * goal is a temperature bias; a ground that is not cool cannot deliver it.
   */
  it("cools a warm khaki to an actually-cool ground, not green", () => {
    const r = recommendUndercoat(DESERT_KHAKI, "cooler");
    const h = hueOf(r.undercoatHex);
    expect(isCool(h)).toBe(true);
    // The specific historical failure.
    expect(h).toBeGreaterThan(160);
  });

  it("warms a cool blue to an actually-warm ground", () => {
    const r = recommendUndercoat(BLUE, "warmer");
    expect(isWarm(hueOf(r.undercoatHex))).toBe(true);
  });

  it("cools a green top rather than drifting further round the wheel", () => {
    const r = recommendUndercoat(GREEN, "cooler");
    expect(isCool(hueOf(r.undercoatHex))).toBe(true);
  });

  it("leaves an already-warm top warm when asked to warm it", () => {
    const r = recommendUndercoat("#D2691E", "warmer");
    expect(isWarm(hueOf(r.undercoatHex))).toBe(true);
  });
});

describe("recommendUndercoat — the curated combos win over the formula", () => {
  it("puts magenta under a yellow glaze for warmth", () => {
    const r = recommendUndercoat("#E8D44D", "warmer");
    expect(r.undercoatLabel).toBe("Magenta");
    expect(r.rationale).toMatch(/subtracts green/i);
  });

  it("puts a magenta-pink under an orange glaze for glow", () => {
    const r = recommendUndercoat("#E07A22", "glow");
    expect(r.undercoatLabel).toMatch(/magenta/i);
  });
});

describe("recommendUndercoat — candy is always metallic", () => {
  it("recommends gold under a warm top and silver under a cool one", () => {
    const warm = recommendUndercoat(DESERT_KHAKI, "candy");
    expect(warm.metallic).toBe(true);
    expect(warm.undercoatLabel).toBe("Gold");
    expect(warm.matchTypes).toEqual(PAINT_TYPE_FILTERS.metallic);

    const cool = recommendUndercoat(BLUE, "candy");
    expect(cool.undercoatLabel).toBe("Silver");
    expect(cool.metallic).toBe(true);
  });
});

describe("recommendUndercoat — shape and robustness", () => {
  it("returns a usable recommendation for every goal", () => {
    for (const { goal } of GOALS) {
      const r = recommendUndercoat(DESERT_KHAKI, goal as Goal);
      expect(r.undercoatHex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(r.predictedHex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(r.rationale.length).toBeGreaterThan(10);
      expect(r.matchTypes.length).toBeGreaterThan(0);
    }
  });

  it("shadow grounds are darker than the paint going over them", () => {
    const r = recommendUndercoat(DESERT_KHAKI, "shadow");
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    expect(lum(r.undercoatHex)).toBeLessThan(lum(DESERT_KHAKI));
  });

  it("does not throw on an unparseable hex", () => {
    expect(() => recommendUndercoat("not-a-hex", "glow")).not.toThrow();
  });
});

describe("hueBucket", () => {
  it("buckets the wheel into the families the combo table keys on", () => {
    expect(hueBucket(0)).toBe("red");
    expect(hueBucket(30)).toBe("orange");
    expect(hueBucket(55)).toBe("yellow");
    expect(hueBucket(120)).toBe("green");
    expect(hueBucket(180)).toBe("cyan");
    expect(hueBucket(220)).toBe("blue");
    expect(hueBucket(270)).toBe("violet");
    expect(hueBucket(300)).toBe("magenta");
    // Wraps rather than falling off the end.
    expect(hueBucket(350)).toBe("red");
    expect(hueBucket(-10)).toBe("red");
  });
});
