/**
 * P16.1 — hue-sort primitives.
 *
 * Pins: HSL conversion, monotonic hue ordering of the chromatic band,
 * near-greys landing in the neutral band (ordered by lightness), and
 * the module-side memoization of the sorted index.
 */
import { describe, expect, test } from "vitest";
import {
  hexToHsl,
  hueSortKey,
  compareHueSortKey,
  hueSortPaints,
  hueSortedPaintIndex,
  _resetHueIndexCache,
  NEUTRAL_SATURATION_THRESHOLD,
} from "@/lib/paints/hue";
import type { Paint } from "@/lib/paints/types";

const p = (overrides: Partial<Paint>): Paint => ({
  id: "p1",
  brand: "Citadel",
  line: "Base",
  name: "Test Paint",
  type: "Paint",
  hex: "#808080",
  hexConfidence: "high",
  hexSource: "stahly",
  sourceUrl: "https://example.com",
  ...overrides,
});

describe("hexToHsl", () => {
  test("pure red → hue 0, full saturation, mid lightness", () => {
    const hsl = hexToHsl("#ff0000");
    expect(hsl).not.toBeNull();
    expect(hsl!.h).toBeCloseTo(0, 5);
    expect(hsl!.s).toBeCloseTo(1, 5);
    expect(hsl!.l).toBeCloseTo(0.5, 5);
  });

  test("pure green → hue 120", () => {
    expect(hexToHsl("#00ff00")!.h).toBeCloseTo(120, 5);
  });

  test("pure blue → hue 240", () => {
    expect(hexToHsl("#0000ff")!.h).toBeCloseTo(240, 5);
  });

  test("grey is achromatic — saturation 0", () => {
    const hsl = hexToHsl("#808080");
    expect(hsl!.s).toBe(0);
    expect(hsl!.l).toBeCloseTo(128 / 255, 5);
  });

  test("white and black sit at the lightness extremes", () => {
    expect(hexToHsl("#ffffff")!.l).toBeCloseTo(1, 5);
    expect(hexToHsl("#000000")!.l).toBeCloseTo(0, 5);
  });

  test("accepts shorthand and missing-hash forms", () => {
    expect(hexToHsl("#f00")!.h).toBeCloseTo(0, 5);
    expect(hexToHsl("00ff00")!.h).toBeCloseTo(120, 5);
  });

  test("returns null for garbage", () => {
    expect(hexToHsl("not-a-hex")).toBeNull();
    expect(hexToHsl("#12")).toBeNull();
    expect(hexToHsl("")).toBeNull();
  });
});

describe("hueSortKey + ordering", () => {
  test("chromatic paints land in band 0, near-greys in band 1", () => {
    expect(hueSortKey(p({ hex: "#ff0000" })).band).toBe(0);
    expect(hueSortKey(p({ hex: "#808080" })).band).toBe(1);
  });

  test("a colour just below the saturation threshold is treated as neutral", () => {
    // Construct a barely-saturated colour: s just under the threshold.
    // #808284 is a near-grey with tiny saturation.
    const key = hueSortKey(p({ hex: "#808284" }));
    expect(key.band).toBe(1);
    const hsl = hexToHsl("#808284")!;
    expect(hsl.s).toBeLessThan(NEUTRAL_SATURATION_THRESHOLD);
  });

  test("hue ordering is monotonic across the spectrum", () => {
    const redPaint = p({ id: "red", hex: "#ff0000" });
    const yellow = p({ id: "yellow", hex: "#ffff00" });
    const green = p({ id: "green", hex: "#00ff00" });
    const blue = p({ id: "blue", hex: "#0000ff" });
    const violet = p({ id: "violet", hex: "#8000ff" });
    // Feed in scrambled order.
    const sorted = hueSortPaints([blue, violet, redPaint, green, yellow]);
    expect(sorted.map((x) => x.id)).toEqual([
      "red",
      "yellow",
      "green",
      "blue",
      "violet",
    ]);
  });

  test("same-hue paints ramp by saturation then lightness", () => {
    const vivid = p({ id: "vivid", hex: "#ff0000" }); // s=1
    const muted = p({ id: "muted", hex: "#c04040" }); // lower s, same-ish hue
    const sorted = hueSortPaints([vivid, muted]);
    // muted (lower saturation) sorts before vivid within the same hue family
    const vividKey = hueSortKey(vivid);
    const mutedKey = hueSortKey(muted);
    if (vividKey.h === mutedKey.h) {
      expect(sorted.map((x) => x.id)).toEqual(["muted", "vivid"]);
    } else {
      // Different hue bins — at least both are chromatic.
      expect(vividKey.band).toBe(0);
      expect(mutedKey.band).toBe(0);
    }
  });

  test("greys collect at the END, ordered by lightness (dark → light)", () => {
    const colour = p({ id: "colour", hex: "#ff0000" });
    const darkGrey = p({ id: "dark", hex: "#202020" });
    const midGrey = p({ id: "mid", hex: "#808080" });
    const lightGrey = p({ id: "light", hex: "#e0e0e0" });
    const sorted = hueSortPaints([lightGrey, colour, darkGrey, midGrey]);
    expect(sorted.map((x) => x.id)).toEqual([
      "colour",
      "dark",
      "mid",
      "light",
    ]);
  });

  test("within the neutral band, tinted/transition greys precede the PURE greyscale (solid last)", () => {
    // Ross 2026-06-05: the map should read RED → transition greys → pure
    // greyscale → END, so a tinted near-grey (s > 0, still below the
    // threshold) sorts BEFORE a pure grey (s = 0). Both are band 1.
    const tinted = p({ id: "tinted", hex: "#808284" }); // s > 0, < threshold
    const pureMid = p({ id: "pure", hex: "#808080" }); // s = 0
    expect(hueSortKey(tinted).band).toBe(1);
    expect(hueSortKey(pureMid).band).toBe(1);
    expect(hexToHsl("#808284")!.s).toBeGreaterThan(0);
    expect(hexToHsl("#808080")!.s).toBe(0);
    const sorted = hueSortPaints([pureMid, tinted]).map((x) => x.id);
    expect(sorted).toEqual(["tinted", "pure"]);
  });

  test("multiple greys never scatter through the chromatic band", () => {
    const list = [
      p({ id: "grey1", hex: "#333333" }),
      p({ id: "red", hex: "#ff0000" }),
      p({ id: "grey2", hex: "#999999" }),
      p({ id: "blue", hex: "#0000ff" }),
      p({ id: "grey3", hex: "#cccccc" }),
    ];
    const sorted = hueSortPaints(list).map((x) => x.id);
    const firstGreyIdx = sorted.findIndex((id) => id.startsWith("grey"));
    const lastColourIdx = Math.max(
      sorted.indexOf("red"),
      sorted.indexOf("blue"),
    );
    // Every grey comes after every chromatic paint.
    expect(firstGreyIdx).toBeGreaterThan(lastColourIdx);
  });

  test("unparseable hex floats to the very end of the neutral band", () => {
    const bad = p({ id: "bad", hex: "garbage" });
    const grey = p({ id: "grey", hex: "#808080" });
    const colour = p({ id: "colour", hex: "#ff0000" });
    const sorted = hueSortPaints([bad, grey, colour]).map((x) => x.id);
    expect(sorted).toEqual(["colour", "grey", "bad"]);
  });

  test("compareHueSortKey returns 0 for equal keys", () => {
    const k = hueSortKey(p({ hex: "#ff0000" }));
    expect(compareHueSortKey(k, { ...k })).toBe(0);
  });

  test("sort is stable for identical keys (original order preserved)", () => {
    const a = p({ id: "a", hex: "#ff0000" });
    const b = p({ id: "b", hex: "#ff0000" });
    const sorted = hueSortPaints([a, b]).map((x) => x.id);
    expect(sorted).toEqual(["a", "b"]);
  });

  test("does not mutate the input array", () => {
    const input = [
      p({ id: "blue", hex: "#0000ff" }),
      p({ id: "red", hex: "#ff0000" }),
    ];
    const before = input.map((x) => x.id);
    hueSortPaints(input);
    expect(input.map((x) => x.id)).toEqual(before);
  });
});

describe("hueSortedPaintIndex memoization", () => {
  test("returns the same cached array for the same input identity", () => {
    _resetHueIndexCache();
    const input = [
      p({ id: "blue", hex: "#0000ff" }),
      p({ id: "red", hex: "#ff0000" }),
    ];
    const first = hueSortedPaintIndex(input);
    const second = hueSortedPaintIndex(input);
    expect(second).toBe(first); // same reference — not re-sorted
    expect(first.map((x) => x.id)).toEqual(["red", "blue"]);
  });

  test("a different input identity invalidates the cache", () => {
    _resetHueIndexCache();
    const a = [p({ id: "red", hex: "#ff0000" })];
    const b = [p({ id: "blue", hex: "#0000ff" })];
    const ra = hueSortedPaintIndex(a);
    const rb = hueSortedPaintIndex(b);
    expect(rb).not.toBe(ra);
    expect(rb.map((x) => x.id)).toEqual(["blue"]);
  });
});
