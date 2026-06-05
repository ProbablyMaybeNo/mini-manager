/**
 * M4.2 / D6.2 — canvas layout math (pure helpers).
 *
 * Tests computeCanvasLayout, cellRectAt, and indexAtPoint from
 * heatSinkHelpers.ts. All three are side-effect-free — no DOM, no React.
 */
import { describe, expect, test } from "vitest";
import {
  CELL_MIN_PX,
  DESKTOP_CELL_MIN_PX,
  cellRectAt,
  computeCanvasLayout,
  dotMetricsForCell,
  fillHeightLayout,
  indexAtPoint,
} from "@/components/library/heatSinkHelpers";

/* ============================================================
   computeCanvasLayout
   ============================================================ */

describe("computeCanvasLayout", () => {
  test("cols = floor(width / cellEdge)", () => {
    const layout = computeCanvasLayout(100, 400, 10);
    expect(layout.cols).toBe(40);
  });

  test("cellSize fills width exactly (width / cols)", () => {
    const layout = computeCanvasLayout(100, 400, 10);
    expect(layout.cellSize).toBe(400 / 40);
  });

  test("rows = ceil(count / cols)", () => {
    // 7144 cells, 400px wide, 4px cell → cols=100, rows=ceil(7144/100)=72
    const layout = computeCanvasLayout(7144, 400, 4);
    expect(layout.cols).toBe(100);
    expect(layout.rows).toBe(Math.ceil(7144 / 100));
  });

  test("height = rows * cellSize", () => {
    const layout = computeCanvasLayout(100, 300, 10);
    expect(layout.height).toBe(layout.rows * layout.cellSize);
  });

  test("width < cellEdge → 1 col", () => {
    const layout = computeCanvasLayout(10, 3, CELL_MIN_PX);
    expect(layout.cols).toBe(1);
  });

  test("width exactly equals cellEdge → 1 col", () => {
    const layout = computeCanvasLayout(10, CELL_MIN_PX, CELL_MIN_PX);
    expect(layout.cols).toBe(1);
  });

  test("zero count → zero rows and zero height", () => {
    const layout = computeCanvasLayout(0, 400, 4);
    expect(layout.rows).toBe(0);
    expect(layout.height).toBe(0);
  });

  test("single cell → 1 row, cols = floor(width/edge)", () => {
    const layout = computeCanvasLayout(1, 400, 10);
    expect(layout.rows).toBe(1);
    expect(layout.cols).toBe(40);
  });

  test("count exactly fills rows (no ragged last row)", () => {
    // 200 cells, 400px, 10px → 40 cols, exactly 5 rows
    const layout = computeCanvasLayout(200, 400, 10);
    expect(layout.rows).toBe(5);
  });
});

/* ============================================================
   cellRectAt
   ============================================================ */

describe("cellRectAt", () => {
  // 100 cells in a 400px-wide canvas at 10px → 40 cols, cellSize=10
  const layout = computeCanvasLayout(100, 400, 10);

  test("index 0 → top-left cell", () => {
    const rect = cellRectAt(0, layout);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.w).toBe(layout.cellSize);
    expect(rect.h).toBe(layout.cellSize);
  });

  test("index = cols - 1 → last cell on first row", () => {
    const rect = cellRectAt(layout.cols - 1, layout);
    expect(rect.x).toBeCloseTo((layout.cols - 1) * layout.cellSize);
    expect(rect.y).toBe(0);
  });

  test("index = cols → first cell on second row", () => {
    const rect = cellRectAt(layout.cols, layout);
    expect(rect.x).toBe(0);
    expect(rect.y).toBeCloseTo(layout.cellSize);
  });

  test("every cell has the same w and h equal to cellSize", () => {
    for (let i = 0; i < 10; i++) {
      const rect = cellRectAt(i, layout);
      expect(rect.w).toBeCloseTo(layout.cellSize);
      expect(rect.h).toBeCloseTo(layout.cellSize);
    }
  });

  test("cells tile contiguously (no gaps)", () => {
    // col N's x + w should equal col N+1's x.
    const r0 = cellRectAt(0, layout);
    const r1 = cellRectAt(1, layout);
    expect(r0.x + r0.w).toBeCloseTo(r1.x);
  });
});

/* ============================================================
   indexAtPoint
   ============================================================ */

describe("indexAtPoint", () => {
  // 7144 cells, 400px wide, 4px → cols=100, rows=72, cellSize=4
  const count = 7144;
  const layout = computeCanvasLayout(count, 400, 4);

  test("point inside the first cell → 0", () => {
    expect(indexAtPoint(0, 0, layout, count)).toBe(0);
  });

  test("point inside the second cell (column 1) → 1", () => {
    expect(indexAtPoint(layout.cellSize + 0.5, 0, layout, count)).toBe(1);
  });

  test("point in first cell of second row → cols", () => {
    expect(indexAtPoint(0, layout.cellSize + 0.5, layout, count)).toBe(layout.cols);
  });

  test("point inside a known cell returns the correct index", () => {
    // cell at (col=5, row=3) → index = 3*100 + 5 = 305
    const x = 5 * layout.cellSize + 0.5;
    const y = 3 * layout.cellSize + 0.5;
    expect(indexAtPoint(x, y, layout, count)).toBe(305);
  });

  test("ragged last row — point in an empty slot beyond count → null", () => {
    // 7144 cells, 100 cols → last row has 44 cells (cols 0-43).
    // Col 44 on the last row → index = 71*100 + 44 = 7144 ≥ count → null.
    const lastRow = (layout.rows - 1) * layout.cellSize + 0.5;
    const emptySlot = 44 * layout.cellSize + 0.5;
    expect(indexAtPoint(emptySlot, lastRow, layout, count)).toBeNull();
  });

  test("point exactly at the last valid cell → count - 1", () => {
    // 7144th cell: index 7143, col = 7143 % 100 = 43, row = 71
    const col = (count - 1) % layout.cols;
    const row = Math.floor((count - 1) / layout.cols);
    const x = col * layout.cellSize + 0.5;
    const y = row * layout.cellSize + 0.5;
    expect(indexAtPoint(x, y, layout, count)).toBe(count - 1);
  });

  test("width < cellEdge layout (1 col) — every point in column 0 maps to a valid index", () => {
    const narrowLayout = computeCanvasLayout(5, 3, CELL_MIN_PX);
    expect(narrowLayout.cols).toBe(1);
    // All 5 cells are in column 0.
    for (let row = 0; row < 5; row++) {
      const idx = indexAtPoint(0, row * narrowLayout.cellSize + 0.5, narrowLayout, 5);
      expect(idx).toBe(row);
    }
  });

  test("zero-size layout → null", () => {
    const zeroLayout = computeCanvasLayout(0, 400, 4);
    // count=0, any point → null
    expect(indexAtPoint(0, 0, zeroLayout, 0)).toBeNull();
  });
});

/* ============================================================
   LIB-COLORMAP-POLISH (1) — fillHeightLayout (desktop height-fill)
   ============================================================ */

describe("DESKTOP_CELL_MIN_PX (desktop pixel floor)", () => {
  test("is a larger floor than the compact CELL_MIN_PX", () => {
    expect(DESKTOP_CELL_MIN_PX).toBeGreaterThan(CELL_MIN_PX);
  });
});

describe("fillHeightLayout", () => {
  test("grows cells past the min edge to fill the available height", () => {
    // 100 cells, 200px wide, 800px tall, 10px min.
    // Width-only densest: cols=20, cellSize=10, rows=5, height=50 → tiny.
    const densest = computeCanvasLayout(100, 200, 10);
    expect(densest.height).toBe(50);
    const filled = fillHeightLayout(100, 200, 800, 10);
    // Fewer columns, bigger cells, taller grid that fits 800.
    expect(filled.cols).toBeLessThan(densest.cols);
    expect(filled.cellSize).toBeGreaterThan(densest.cellSize);
    expect(filled.height).toBeGreaterThan(densest.height);
    expect(filled.height).toBeLessThanOrEqual(800);
  });

  test("chooses the largest fitting cell when there is vertical room", () => {
    // 300 cells, 200px wide, 800px tall, 10px min — fits with room to grow.
    const filled = fillHeightLayout(300, 200, 800, 10);
    expect(filled.height).toBeLessThanOrEqual(800);
    // One fewer column would overshoot the height — confirms it's maximal.
    const oneFewer = filled.cols - 1;
    if (oneFewer >= 1) {
      const cellSize = 200 / oneFewer;
      const rows = Math.ceil(300 / oneFewer);
      expect(rows * cellSize).toBeGreaterThan(800);
    }
  });

  test("cells never shrink below the min edge", () => {
    const filled = fillHeightLayout(100, 200, 800, 10);
    expect(filled.cellSize).toBeGreaterThanOrEqual(10);
  });

  test("falls back to the densest (scrolling) layout when even min cells overflow", () => {
    // A huge catalog in a short panel: densest already exceeds the height.
    const densest = computeCanvasLayout(7144, 320, DESKTOP_CELL_MIN_PX);
    expect(densest.height).toBeGreaterThan(200);
    const filled = fillHeightLayout(7144, 320, 200, DESKTOP_CELL_MIN_PX);
    expect(filled).toEqual(densest);
  });

  test("unmeasured height (<=0) falls back to the width-only layout", () => {
    const densest = computeCanvasLayout(100, 200, 10);
    expect(fillHeightLayout(100, 200, 0, 10)).toEqual(densest);
    expect(fillHeightLayout(100, 200, -5, 10)).toEqual(densest);
  });

  test("zero count → zero rows, no growth", () => {
    const filled = fillHeightLayout(0, 200, 800, 10);
    expect(filled.rows).toBe(0);
    expect(filled.height).toBe(0);
  });

  test("columns fill the width exactly (cellSize = width / cols)", () => {
    const filled = fillHeightLayout(100, 200, 800, 10);
    expect(filled.cellSize).toBeCloseTo(200 / filled.cols);
    expect(filled.width).toBe(200);
  });
});

/* ============================================================
   LIB-COLORMAP-POLISH (3) — dotMetricsForCell (legible markers)
   ============================================================ */

describe("dotMetricsForCell", () => {
  test("the dot grows with the cell", () => {
    const small = dotMetricsForCell(4);
    const big = dotMetricsForCell(20);
    expect(big.size).toBeGreaterThan(small.size);
  });

  test("never shrinks below the small-cell floor", () => {
    expect(dotMetricsForCell(1).size).toBeGreaterThanOrEqual(7);
  });

  test("the ring is always a visible outline (>=1px), clamped to a crisp max", () => {
    for (const cell of [4, 9, 14, 24, 40]) {
      const { ring } = dotMetricsForCell(cell);
      expect(ring).toBeGreaterThanOrEqual(1);
      expect(ring).toBeLessThanOrEqual(3);
    }
  });

  test("the ring grows with the dot up to its clamp", () => {
    expect(dotMetricsForCell(20).ring).toBeGreaterThanOrEqual(
      dotMetricsForCell(4).ring,
    );
  });
});
