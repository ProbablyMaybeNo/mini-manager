/**
 * P16.4 — performance-pass pure helpers for the heat-sink grid.
 *
 * These back the client wrapper's render: row-chunking (so off-screen
 * groups skip layout/paint), the brand filter (narrow the working set),
 * the Condensed view (collection-only spectrum), and the default-density
 * pick (Condensed once the collection is big enough to read). All pure,
 * unit-tested here; the client (HeatSinkGridClient) just composes them.
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  CELLS_PER_ROW_GROUP,
  CELL_MIN_PX,
  CONDENSED_DEFAULT_THRESHOLD,
  chunkCells,
  condensedCells,
  detectMobileViewport,
  filterCellsByBrands,
  gridColumnsFor,
  intrinsicRowSizeFor,
  pickDefaultDensity,
  rowGroupCount,
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

describe("condensedCells (P16.4 condensed view)", () => {
  const cells = [
    cell("a", "Citadel", "owned"),
    cell("b", "Citadel", "none"),
    cell("c", "Citadel", "wanted"),
    cell("d", "Citadel", "none"),
  ];

  test("keeps only owned + wanted (the collection), drops gaps", () => {
    const out = condensedCells(cells);
    expect(out.map((c) => c.paint.id)).toEqual(["a", "c"]);
  });

  test("full set has more cells than condensed when gaps exist", () => {
    expect(condensedCells(cells).length).toBeLessThan(cells.length);
  });

  test("collection with no gaps is unchanged in length", () => {
    const allOwned = [cell("a", "Citadel", "owned"), cell("b", "Citadel", "wanted")];
    expect(condensedCells(allOwned)).toHaveLength(2);
  });
});

describe("pickDefaultDensity (P16.4 default density)", () => {
  const summary = (owned: number, wanted: number) => ({
    owned,
    wanted,
    total: 7144,
    ownedPct: 0,
  });

  test("Full when the collection is below the threshold", () => {
    expect(pickDefaultDensity(summary(10, 5))).toBe("full");
  });

  test("Condensed at the threshold", () => {
    expect(pickDefaultDensity(summary(CONDENSED_DEFAULT_THRESHOLD, 0))).toBe(
      "condensed",
    );
  });

  test("Condensed above the threshold, counting owned + wanted", () => {
    expect(
      pickDefaultDensity(
        summary(CONDENSED_DEFAULT_THRESHOLD - 10, 10),
      ),
    ).toBe("condensed");
  });

  test("empty collection → Full (something to fill)", () => {
    expect(pickDefaultDensity(summary(0, 0))).toBe("full");
  });

  // UX-1302 — a coarse-pointer / narrow client must NEVER default to Full
  // (a wall of ~12px sub-target cells). It always lands on Condensed,
  // regardless of collection size, including a brand-new 0-owned recruit.
  test("mobile always defaults to Condensed regardless of collection", () => {
    expect(pickDefaultDensity(summary(0, 0), true)).toBe("condensed");
    expect(pickDefaultDensity(summary(10, 5), true)).toBe("condensed");
    expect(
      pickDefaultDensity(summary(CONDENSED_DEFAULT_THRESHOLD + 100, 0), true),
    ).toBe("condensed");
  });

  test("desktop (isMobile=false) keeps the threshold behaviour", () => {
    expect(pickDefaultDensity(summary(0, 0), false)).toBe("full");
    expect(
      pickDefaultDensity(summary(CONDENSED_DEFAULT_THRESHOLD, 0), false),
    ).toBe("condensed");
  });
});

describe("detectMobileViewport (UX-1301/1302 mobile gate)", () => {
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
   P16.6 — mobile cell sizing (UX-1202)
   ============================================================ */

describe("CELL_MIN_PX (P16.6 mobile cell sizing)", () => {
  test("Condensed cells clear the 24px WCAG 2.5.8 target floor", () => {
    // Condensed is the default once a collection clears the threshold and
    // the surface the painter actually taps — it must be tappable.
    expect(CELL_MIN_PX.condensed).toBeGreaterThanOrEqual(24);
  });

  test("Condensed cells are bigger than Full (reach over density)", () => {
    expect(CELL_MIN_PX.condensed).toBeGreaterThan(CELL_MIN_PX.full);
  });

  test("Full cells floor at >=20px (UX-1302 near-target overview)", () => {
    // UX-1302: even the dense catalog overview never drops below a 20px
    // near-target floor on coarse pointers — the auto-fill columns just
    // reflow to fewer columns. Well clear of the old 7px / 12.6px walls.
    expect(CELL_MIN_PX.full).toBeGreaterThanOrEqual(20);
  });
});

describe("gridColumnsFor (P16.6 reflow to full width)", () => {
  test("uses auto-fill with the density's min cell edge and a 1fr companion", () => {
    // `1fr` makes columns grow past the floor to consume leftover width,
    // so a wider phone enlarges cells instead of growing side margin.
    expect(gridColumnsFor("condensed")).toBe(
      "repeat(auto-fill, minmax(" + CELL_MIN_PX.condensed + "px, 1fr))",
    );
    expect(gridColumnsFor("full")).toBe(
      "repeat(auto-fill, minmax(" + CELL_MIN_PX.full + "px, 1fr))",
    );
  });

  test("Condensed columns request a wider min than Full", () => {
    // A crude but stable assertion that the Condensed template is the
    // tappable one.
    expect(gridColumnsFor("condensed")).toContain(
      CELL_MIN_PX.condensed + "px",
    );
    expect(gridColumnsFor("full")).toContain(CELL_MIN_PX.full + "px");
  });
});

describe("intrinsicRowSizeFor (P16.6 scroll stability)", () => {
  test("tracks the density's cell min edge so reserved space matches", () => {
    expect(intrinsicRowSizeFor("condensed")).toBe(CELL_MIN_PX.condensed);
    expect(intrinsicRowSizeFor("full")).toBe(CELL_MIN_PX.full);
  });
});
