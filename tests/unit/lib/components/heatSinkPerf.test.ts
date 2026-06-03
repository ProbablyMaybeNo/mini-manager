/**
 * P16.4 / P17 — performance-pass pure helpers for the heat-sink grid.
 *
 * These back the client wrapper's render: row-chunking (so off-screen
 * groups skip layout/paint), the brand filter (narrow the working set),
 * and the fixed tiny-pixel sizing for the spectrum field. All pure,
 * unit-tested here; the client (HeatSinkGridClient) just composes them.
 *
 * P17 removed the condensed/full density mode entirely — the field always
 * shows every catalog paint (modulo the brand filter), because the unowned
 * pixels are the map of the full gamut. There is no `condensedCells`,
 * `pickDefaultDensity`, `GridDensity`, or per-density sizing any more.
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  CELLS_PER_ROW_GROUP,
  CELL_MIN_PX,
  DOT_RING_PX,
  DOT_SIZE_PX,
  OVERLAY_SAMPLE_STRIDE,
  chunkCells,
  detectMobileViewport,
  filterCellsByBrands,
  gridColumnsFor,
  intrinsicRowSize,
  rowGroupCount,
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

describe("chunkCells (P16.4 row-chunking)", () => {
  test("splits into fixed-size groups, last group short", () => {
    const groups = chunkCells(many(250), 100);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveLength(100);
    expect(groups[1]).toHaveLength(100);
    expect(groups[2]).toHaveLength(50);
  });

  test("default group size is CELLS_PER_ROW_GROUP", () => {
    const groups = chunkCells(many(CELLS_PER_ROW_GROUP * 2 + 1));
    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveLength(CELLS_PER_ROW_GROUP);
  });

  test("7,144 cells chunk to the expected group count", () => {
    const groups = chunkCells(many(7144), CELLS_PER_ROW_GROUP);
    expect(groups).toHaveLength(Math.ceil(7144 / CELLS_PER_ROW_GROUP));
    const total = groups.reduce((acc, g) => acc + g.length, 0);
    expect(total).toBe(7144);
  });

  test("empty input → no groups (not one empty group)", () => {
    expect(chunkCells([], 100)).toHaveLength(0);
  });

  test("preserves order across the split", () => {
    const groups = chunkCells(many(5), 2);
    const flat = groups.flat().map((c) => c.paint.id);
    expect(flat).toEqual(["c0", "c1", "c2", "c3", "c4"]);
  });

  test("throws on non-positive group size", () => {
    expect(() => chunkCells(many(3), 0)).toThrow();
  });
});

describe("rowGroupCount (P16.4)", () => {
  test("matches the chunk count without allocating", () => {
    expect(rowGroupCount(250, 100)).toBe(3);
    expect(rowGroupCount(0, 100)).toBe(0);
    expect(rowGroupCount(100, 100)).toBe(1);
    expect(rowGroupCount(101, 100)).toBe(2);
  });
});

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
  // The unowned pixels ARE the map of the gamut, so the cell set is NEVER
  // narrowed by ownership — only the brand filter cuts cells. This pins
  // that there is no collection-only "condensed" pass any more: an owned +
  // wanted + none mix all survive into the rendered field.
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
  // The unit project runs in Node (no `window`). We install a fake
  // `globalThis.window` per case to exercise the coarse-pointer / narrow
  // branches, then tear it down so SSR-safety (the `undefined window`
  // path) is also covered.
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
    // A1 (Ross 2026-06-03): 9px was still too big. The cell must be
    // pixel-sized so all ~7,144 paints fit into a compact square.
    expect(CELL_MIN_PX).toBeLessThanOrEqual(4);
    expect(CELL_MIN_PX).toBeGreaterThan(0);
  });

  test("A2: the overlay dot is larger than the cell — an approximate, legible marker", () => {
    // At ~4px a dot CONFINED to one cell would be invisible. The A2
    // overlay dot is deliberately larger than the cell (it estimates
    // where the collection falls, it is not a pixel-precise tag) so it
    // stays legible. The dot + ring intentionally EXCEEDS the cell edge.
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
    // stride 1 = a dot on every marked cell.
    expect(showsOverlayDot(5, 1)).toBe(true);
  });

  test("throws on a non-positive stride", () => {
    expect(() => showsOverlayDot(0, 0)).toThrow();
  });
});

describe("gridColumnsFor (P17 reflow to full width)", () => {
  test("uses auto-fill with the fixed cell edge and a 1fr companion", () => {
    // `1fr` makes columns grow past the floor to consume leftover width,
    // so a wider viewport packs more pixels instead of growing side margin.
    expect(gridColumnsFor()).toBe(
      "repeat(auto-fill, minmax(" + CELL_MIN_PX + "px, 1fr))",
    );
  });

  test("takes no density argument", () => {
    expect(gridColumnsFor.length).toBe(0);
  });
});

describe("intrinsicRowSize (P17 scroll stability)", () => {
  test("tracks the fixed cell edge so reserved space matches", () => {
    expect(intrinsicRowSize()).toBe(CELL_MIN_PX);
  });
});
