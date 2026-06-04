/**
 * P16.3 / P17 / M4.2 — HeatSink grid view-pure helpers.
 *
 * Pins the header readout formatting ("1,204 / 7,144 owned · 312 wanted").
 *
 * M4.2 / D6.2: COVERAGE_DOT_CLASS and dotClassFor are removed (the canvas
 * draws dots with concrete token colours read from getComputedStyle, not
 * Tailwind classes). The dotClassFor describe block is removed accordingly.
 * Canvas layout math is tested in collectionCanvasHelpers.test.ts.
 */
import { describe, expect, test } from "vitest";
import {
  coverageReadout,
  formatCount,
} from "@/components/library/heatSinkHelpers";
import type { CoverageSummary } from "@/lib/paints/coverage";

describe("formatCount (P16.3)", () => {
  test("groups thousands with commas", () => {
    expect(formatCount(1204)).toBe("1,204");
    expect(formatCount(7144)).toBe("7,144");
  });

  test("leaves small numbers bare", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(312)).toBe("312");
  });
});

describe("coverageReadout (P16.3)", () => {
  const summary = (over: Partial<CoverageSummary>): CoverageSummary => ({
    owned: 0,
    wanted: 0,
    total: 0,
    ownedPct: 0,
    ...over,
  });

  test("formats the locked header string with grouped counts", () => {
    expect(
      coverageReadout(summary({ owned: 1204, total: 7144, wanted: 312 })),
    ).toBe("1,204 / 7,144 owned · 312 wanted");
  });

  test("zeroed collection reads cleanly", () => {
    expect(coverageReadout(summary({ owned: 0, total: 7144, wanted: 0 }))).toBe(
      "0 / 7,144 owned · 0 wanted",
    );
  });
});
