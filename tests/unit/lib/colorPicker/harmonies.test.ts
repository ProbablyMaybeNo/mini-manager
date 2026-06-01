import { describe, expect, test } from "vitest";
import {
  COLOR_PICKER_HARMONY_LABELS,
  buildPickerHarmony,
  hslToHex,
} from "@/lib/colorPicker/harmonies";
import {
  COLOR_PICKER_HARMONIES,
  type ColorPickerHarmony,
} from "@/lib/colorPicker/types";

/* P12.1 — ColorPicker harmony wrapper tests.
 *
 * The picker exposes the Phase-12 locked set
 * (mono / analogous / complementary / triadic / split / square / tetradic).
 * Underlying maths is the well-tested wheel-tool harmony generators;
 * these tests confirm the key translation + cap (≤6) + the locked set
 * stay aligned. */

describe("ColorPicker harmonies — Q&A-locked set", () => {
  test("the locked seven keys are exposed in COLOR_PICKER_HARMONIES", () => {
    expect([...COLOR_PICKER_HARMONIES].sort()).toEqual(
      [
        "analogous",
        "complementary",
        "mono",
        "split",
        "square",
        "tetradic",
        "triadic",
      ].sort(),
    );
  });

  test("the label table covers every key, in order", () => {
    const labelKeys = COLOR_PICKER_HARMONY_LABELS.map((h) => h.key);
    expect(labelKeys).toEqual([
      "mono",
      "analogous",
      "complementary",
      "triadic",
      "split",
      "square",
      "tetradic",
    ]);
    // No duplicates
    expect(new Set(labelKeys).size).toBe(labelKeys.length);
    // All have human labels
    for (const item of COLOR_PICKER_HARMONY_LABELS) {
      expect(item.label.length).toBeGreaterThan(2);
    }
  });

  test("every harmony returns at least 2 swatches and no more than 6", () => {
    for (const key of COLOR_PICKER_HARMONIES) {
      const out = buildPickerHarmony(key as ColorPickerHarmony, 180, 60, 55);
      expect(out.length).toBeGreaterThanOrEqual(2);
      expect(out.length).toBeLessThanOrEqual(6);
      // Every entry is a valid #RRGGBB upper-case hex
      for (const hex of out) {
        expect(hex).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  test("complementary returns the input hue + its 180° opposite", () => {
    const out = buildPickerHarmony("complementary", 0, 100, 50);
    expect(out.length).toBe(2);
    // 0° at 100/50 = pure red. 180° opposite = pure cyan.
    expect(out[0]).toBe("#FF0000");
    expect(out[1]).toBe("#00FFFF");
  });

  test("triadic returns three evenly-spaced hues", () => {
    const out = buildPickerHarmony("triadic", 0, 100, 50);
    expect(out.length).toBe(3);
    // 0 / 120 / 240 at 100/50 = red / green / blue.
    expect(out[0]).toBe("#FF0000");
    expect(out[1]).toBe("#00FF00");
    expect(out[2]).toBe("#0000FF");
  });

  test("mono key dispatches to the monochromatic generator (5 swatches)", () => {
    const out = buildPickerHarmony("mono", 180, 60, 50);
    expect(out.length).toBe(5);
    // All share the same hue → the first two hex chars (R channel) won't
    // necessarily be equal because S/L vary, but converting each back to
    // HSL would show identical hue. Easier: just confirm the swatches
    // are distinct, since the helper steps L by +/- 25 / 12.
    const unique = new Set(out);
    expect(unique.size).toBe(5);
  });

  test("split key dispatches to splitComplementary (3 swatches)", () => {
    const out = buildPickerHarmony("split", 0, 100, 50);
    expect(out.length).toBe(3);
    expect(out[0]).toBe("#FF0000");
    // The two flanking complements are at 150° and 210° (180 ± 30).
    // hslToHex(150, 100, 50) = teal-green, hslToHex(210, 100, 50) = blue.
    // We just check they're not equal to each other or the primary.
    expect(out[1]).not.toBe(out[0]);
    expect(out[2]).not.toBe(out[0]);
    expect(out[1]).not.toBe(out[2]);
  });
});

describe("ColorPicker hslToHex re-export", () => {
  test("hslToHex maps pure HSL primaries to the expected hex", () => {
    expect(hslToHex(0, 100, 50)).toBe("#FF0000");
    expect(hslToHex(120, 100, 50)).toBe("#00FF00");
    expect(hslToHex(240, 100, 50)).toBe("#0000FF");
  });

  test("hslToHex wraps hues past 360 cleanly", () => {
    expect(hslToHex(360, 100, 50)).toBe(hslToHex(0, 100, 50));
    expect(hslToHex(720, 100, 50)).toBe(hslToHex(0, 100, 50));
  });
});
