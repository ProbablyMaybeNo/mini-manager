import { describe, expect, test } from "vitest";
import {
  cardHeightFor,
  computeSwatchGrid,
  SHARE_CARD_RATIOS,
  shareCardFilename,
} from "@/lib/shareCard/layout";

describe("cardHeightFor", () => {
  test("1:1 is square", () => {
    expect(cardHeightFor("1:1", 540)).toBe(540);
    expect(cardHeightFor("1:1", 320)).toBe(320);
  });

  test("9:16 is taller than wide", () => {
    expect(cardHeightFor("9:16", 540)).toBe(960);
    expect(cardHeightFor("9:16", 1080)).toBe(1920);
  });

  test("SHARE_CARD_RATIOS exposes exactly the two shipped ratios", () => {
    expect(SHARE_CARD_RATIOS.map((r) => r.value)).toEqual(["1:1", "9:16"]);
  });
});

describe("computeSwatchGrid", () => {
  test("1:1 caps at 4 columns, 9:16 caps at 3", () => {
    const square = computeSwatchGrid({ ratio: "1:1", slotCount: 8, areaWidthPx: 960 });
    expect(square.columns).toBe(4);
    expect(square.rows).toBe(2);

    const story = computeSwatchGrid({ ratio: "9:16", slotCount: 8, areaWidthPx: 960 });
    expect(story.columns).toBe(3);
    expect(story.rows).toBe(3);
  });

  test("never exceeds the slot count in columns", () => {
    const grid = computeSwatchGrid({ ratio: "1:1", slotCount: 2, areaWidthPx: 960 });
    expect(grid.columns).toBe(2);
    expect(grid.rows).toBe(1);
  });

  test("a slotless recipe still lays out a single placeholder column", () => {
    const grid = computeSwatchGrid({ ratio: "1:1", slotCount: 0, areaWidthPx: 960 });
    expect(grid.columns).toBe(1);
    expect(grid.rows).toBe(1);
  });

  test("large squares fit the paint name inside; small squares push it below", () => {
    const roomy = computeSwatchGrid({ ratio: "1:1", slotCount: 2, areaWidthPx: 960 });
    expect(roomy.swatchSizePx).toBeGreaterThanOrEqual(96);
    expect(roomy.nameInsideSwatch).toBe(true);

    const cramped = computeSwatchGrid({ ratio: "9:16", slotCount: 12, areaWidthPx: 300 });
    expect(cramped.swatchSizePx).toBeLessThan(96);
    expect(cramped.nameInsideSwatch).toBe(false);
  });

  test("swatch size never shrinks below the 40px floor even with many slots", () => {
    const grid = computeSwatchGrid({ ratio: "9:16", slotCount: 50, areaWidthPx: 200 });
    expect(grid.swatchSizePx).toBeGreaterThanOrEqual(40);
  });

  test("gap width is subtracted from the available area", () => {
    const noGap = computeSwatchGrid({ ratio: "1:1", slotCount: 2, areaWidthPx: 200, gapPx: 0 });
    const withGap = computeSwatchGrid({ ratio: "1:1", slotCount: 2, areaWidthPx: 200, gapPx: 20 });
    expect(withGap.swatchSizePx).toBeLessThan(noGap.swatchSizePx);
  });
});

describe("shareCardFilename", () => {
  test("slugifies the recipe name and appends the brand suffix", () => {
    expect(shareCardFilename("Ultramarine Blue Armour")).toBe(
      "ultramarine-blue-armour-mini-mainframe.png",
    );
  });

  test("strips punctuation and collapses whitespace", () => {
    expect(shareCardFilename("  Grimdark's \"Best\" Scheme!! ")).toBe(
      "grimdark-s-best-scheme-mini-mainframe.png",
    );
  });

  test("falls back to a generic name for the imageless/no-recipe card", () => {
    expect(shareCardFilename(null)).toBe("mini-mainframe-card-mini-mainframe.png");
    expect(shareCardFilename(undefined)).toBe("mini-mainframe-card-mini-mainframe.png");
    expect(shareCardFilename("   ")).toBe("mini-mainframe-card-mini-mainframe.png");
  });
});
