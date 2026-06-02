/**
 * P16.4 — performance-pass pure helpers for the heat-sink grid.
 *
 * These back the client wrapper's render: row-chunking (so off-screen
 * groups skip layout/paint), the brand filter (narrow the working set),
 * the Condensed view (collection-only spectrum), and the default-density
 * pick (Condensed once the collection is big enough to read). All pure,
 * unit-tested here; the client (HeatSinkGridClient) just composes them.
 */
import { describe, expect, test } from "vitest";
import {
  CELLS_PER_ROW_GROUP,
  CONDENSED_DEFAULT_THRESHOLD,
  chunkCells,
  condensedCells,
  filterCellsByBrands,
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
});
