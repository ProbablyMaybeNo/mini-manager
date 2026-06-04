/**
 * P16.4 / P17 / M4.2 — performance-pass pure helpers for the heat-sink grid.
 *
 * These back the client wrapper's render: the brand filter (narrow the
 * working set) and the fixed tiny-pixel sizing for the spectrum field.
 * All pure, unit-tested here; the client (HeatSinkGridClient) composes them.
 *
 * M4.2 / D6.2: the row-chunking DOM helpers (chunkCells, rowGroupCount,
 * gridColumnsFor, intrinsicRowSize) and CSS-class dot helpers
 * (COVERAGE_DOT_CLASS, dotClassFor) are deleted — tests removed accordingly.
 * Canvas layout math is tested in collectionCanvasHelpers.test.ts.
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  CELL_MIN_PX,
  DOT_RING_PX,
  DOT_SIZE_PX,
  OVERLAY_SAMPLE_STRIDE,
  detectMobileViewport,
  filterCellsByBrands,
  showsOverlayDot,
} from "@/components/planner/heatSinkHelpers";
import type { CoverageCell } from "@/db/queries/paintCoverage";
import type { CoverageState } from "@/lib/paints/coverage";
import type { Paint } from "@/lib/paints/types";

const paint = (id: string, brand: string): Paint => ({
  id,
  brand,
  line: "Base",
  name: id,
  type: "Paint",
  hex: "#808080",
  hexConfidence: "high",
  hexSource: "stahly",
  sourceUrl: "https://example.com",
});

const cell = (
  id: string,
  brand: string,
  state: CoverageState,
): CoverageCell => ({ paint: paint(id, brand), state });

/** N cells of one brand/state, ids "c0".."cN-1". */
function many(n: number, brand = "Citadel", state: CoverageState = "none") {
  return Array.from({ length: n }, (_, i) => cell("c" + i, brand, state));
}

describe("filterCellsByBrands (P16.4 brand filter)", () => {
  const cells = [
    cell("a", "Citadel", "owned"),
    cell("b", "Vallejo", "none"),
    cell("c", "Citadel", "wanted"),
    cell("d", "Army Painter", "none"),
  ];

  test("null → all brands (unfiltered, copy returned)", () => {
    const out = filterCellsByBrands(cells, null);
    expect(out.map((c) => c.paint.id)).toEqual(["a", "b", "c", "d"]);
    expect(out).not.toBe(cells);
  });

  test("narrows to the selected brands, order preserved", () => {
    const out = filterCellsByBrands(cells, ["Citadel"]);
    expect(out.map((c) => c.paint.id)).toEqual(["a", "c"]);
  });

  test("multiple brands union", () => {
    const out = filterCellsByBrands(cells, ["Vallejo", "Army Painter"]);
    expect(out.map((c) => c.paint.id)).toEqual(["b", "d"]);
  });

  test("empty selection keeps nothing", () => {
    expect(filterCellsByBrands(cells, [])).toHaveLength(0);
  });
});

describe("P17 — the field shows every paint (no density filtering)", () => {
  const cells = [
    cell("a", "Citadel", "owned"),
    cell("b", "Citadel", "none"),
    cell("c", "Citadel", "wanted"),
    cell("d", "Citadel", "none"),
  ];

  test("the brand-unfiltered set keeps every cell, gaps included", () => {
    const out = filterCellsByBrands(cells, null);
    expect(out.map((c) => c.paint.id)).toEqual(["a", "b", "c", "d"]);
  });

  test("'none' (unowned) cells are never dropped — they are the map", () => {
    const out = filterCellsByBrands(cells, null);
    expect(out.some((c) => c.state === "none")).toBe(true);
    expect(out.filter((c) => c.state === "none")).toHaveLength(2);
  });
});

describe("detectMobileViewport (UX-1301 mobile gate)", () => {
  const hadWindow = "window" in globalThis;

  afterEach(() => {
    if (!hadWindow) delete (globalThis as { window?: unknown }).window;
  });

  const stub = (opts: { coarse: boolean; width: number }) => {
    (globalThis as { window?: unknown }).window = {
      innerWidth: opts.width,
      matchMedia: (query: string) => ({
        matches: query.includes("coarse") ? opts.coarse : false,
        media: query,
      }),
    };
  };

  test("returns false when window is undefined (SSR-safe)", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(detectMobileViewport()).toBe(false);
  });

  test("coarse pointer → mobile even on a wide viewport", () => {
    stub({ coarse: true, width: 1024 });
    expect(detectMobileViewport()).toBe(true);
  });

  test("narrow viewport → mobile even with a fine pointer", () => {
    stub({ coarse: false, width: 375 });
    expect(detectMobileViewport()).toBe(true);
  });

  test("fine pointer on a wide viewport → desktop", () => {
    stub({ coarse: false, width: 1280 });
    expect(detectMobileViewport()).toBe(false);
  });
});

/* ============================================================
   P17 / A1 — pixel-field cell sizing (one fixed tiny edge, no density)
   ============================================================ */

describe("CELL_MIN_PX (A1 literally-pixel-sized edge)", () => {
  test("is a single fixed number, not a per-density record", () => {
    expect(typeof CELL_MIN_PX).toBe("number");
  });

  test("is literally pixel-sized (~3-4px) so the whole library packs into a compact square", () => {
    expect(CELL_MIN_PX).toBeLessThanOrEqual(4);
    expect(CELL_MIN_PX).toBeGreaterThan(0);
  });

  test("A2: the overlay dot is larger than the cell — an approximate, legible marker", () => {
    expect(DOT_SIZE_PX + DOT_RING_PX * 2).toBeGreaterThan(CELL_MIN_PX);
    expect(DOT_SIZE_PX).toBeGreaterThan(0);
    expect(DOT_RING_PX).toBeGreaterThan(0);
  });
});

describe("showsOverlayDot (A2 sparse approximate overlay)", () => {
  test("the first marked cell always shows so a tiny collection isn't invisible", () => {
    expect(showsOverlayDot(0)).toBe(true);
  });

  test("samples every OVERLAY_SAMPLE_STRIDE-th marked cell", () => {
    expect(OVERLAY_SAMPLE_STRIDE).toBeGreaterThan(1);
    expect(showsOverlayDot(0)).toBe(true);
    expect(showsOverlayDot(1)).toBe(false);
    expect(showsOverlayDot(OVERLAY_SAMPLE_STRIDE)).toBe(true);
    expect(showsOverlayDot(OVERLAY_SAMPLE_STRIDE - 1)).toBe(false);
    expect(showsOverlayDot(OVERLAY_SAMPLE_STRIDE * 2)).toBe(true);
  });

  test("a custom stride controls the sparseness", () => {
    expect(showsOverlayDot(2, 2)).toBe(true);
    expect(showsOverlayDot(3, 2)).toBe(false);
    expect(showsOverlayDot(5, 1)).toBe(true);
  });

  test("throws on a non-positive stride", () => {
    expect(() => showsOverlayDot(0, 0)).toThrow();
  });
});

// Helpers for cell count assertions (no longer needing chunkCells).
describe("cell count arithmetic (no chunking)", () => {
  test("many() produces the requested count", () => {
    expect(many(7144).length).toBe(7144);
  });
});
