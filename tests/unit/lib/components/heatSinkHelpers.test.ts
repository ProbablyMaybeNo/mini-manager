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
  HUE_BUCKET_TICKS,
  cellHoverReadout,
  coverageReadout,
  coverageStateLabel,
  formatCount,
} from "@/components/library/heatSinkHelpers";
import type { CoverageState, CoverageSummary } from "@/lib/paints/coverage";
import type { CoverageCell } from "@/db/queries/paintCoverage";
import type { Paint } from "@/lib/paints/types";

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

/* ============================================================
   UX-009 — colour-map legend + hover readout helpers.
   ============================================================ */

const paint = (over: Partial<Paint> = {}): Paint => ({
  id: "p1",
  brand: "Citadel",
  name: "Mephiston Red",
  type: "Paint",
  hex: "#9a1115",
  hexConfidence: "high",
  hexSource: "stahly",
  sourceUrl: "https://example.test/p1",
  ...over,
});

const cell = (state: CoverageState, over: Partial<Paint> = {}): CoverageCell => ({
  paint: paint(over),
  state,
});

describe("HUE_BUCKET_TICKS (UX-009)", () => {
  test("sweeps the named hue buckets in spectrum order", () => {
    expect(HUE_BUCKET_TICKS.map((t) => t.label)).toEqual([
      "Red",
      "Orange",
      "Yellow",
      "Green",
      "Cyan",
      "Blue",
      "Violet",
      "Magenta",
    ]);
  });

  test("every tick carries a data-hex swatch (not a token)", () => {
    for (const tick of HUE_BUCKET_TICKS) {
      expect(tick.swatch).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("coverageStateLabel (UX-009)", () => {
  test("maps each coverage state to a human label", () => {
    expect(coverageStateLabel("owned")).toBe("owned");
    expect(coverageStateLabel("wanted")).toBe("wanted");
    expect(coverageStateLabel("none")).toBe("not owned");
  });
});

describe("cellHoverReadout (UX-009)", () => {
  test("resting (null cell) shows the inspect/jump hint", () => {
    expect(cellHoverReadout(null)).toBe(
      "Hover a cell to inspect · click to jump the list",
    );
  });

  test("names brand · paint · hex · state for a hovered cell", () => {
    expect(cellHoverReadout(cell("owned"))).toBe(
      "Citadel · Mephiston Red · #9A1115 · owned",
    );
  });

  test("prefers the effective (override) state over the cell state", () => {
    // Cell server-state is none, but the optimistic override says owned.
    expect(cellHoverReadout(cell("none"), "owned")).toBe(
      "Citadel · Mephiston Red · #9A1115 · owned",
    );
  });

  test("falls back to the cell's own state when no override is given", () => {
    expect(cellHoverReadout(cell("wanted"))).toContain("· wanted");
  });
});
