/**
 * P16.3 / P17 / M4.2 — view-pure helpers for the HeatSink coverage grid.
 *
 * No React, no DB — unit-tested in isolation. Jobs:
 *   - Format the header readout ("1,204 / 7,144 owned · 312 wanted").
 *   - Brand-filter narrowing of the visible cell set.
 *   - Mobile viewport detection (SSR-safe).
 *   - A2 sparse overlay dot sampling (showsOverlayDot).
 *   - Canvas layout math (pure, no DOM): computeCanvasLayout, cellRectAt,
 *     indexAtPoint.
 *   - Gap-fill candidate building and heading/label copy.
 *
 * M4.2 / D6.2 — the row-chunking DOM helpers (chunkCells, rowGroupCount,
 * gridColumnsFor, intrinsicRowSize) and the CSS-class dot helpers
 * (COVERAGE_DOT_CLASS, dotClassFor) are REMOVED: the canvas draws dots with
 * concrete token colours read from getComputedStyle, not Tailwind classes.
 */
import type { CoverageState } from "@/lib/paints/coverage";
import type { CoverageSummary } from "@/lib/paints/coverage";
import { nearestPaintsByHue } from "@/lib/paints/coverage";
import type { CoverageCell } from "@/db/queries/paintCoverage";
import type { Paint } from "@/lib/paints/types";

/** Thousands-separated count, locale-stable ("1204" → "1,204"). */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * The header readout string, e.g. "1,204 / 7,144 owned · 312 wanted".
 * Counts are comma-grouped; the middot separates the two buckets.
 */
export function coverageReadout(summary: CoverageSummary): string {
  return (
    formatCount(summary.owned) +
    " / " +
    formatCount(summary.total) +
    " owned · " +
    formatCount(summary.wanted) +
    " wanted"
  );
}

/* ============================================================
   UX-009 — colour-map legend + live hover readout.

   The spectrum is hue-sorted left→right, top→bottom, so its horizontal
   axis is effectively a hue ramp. These pure helpers give the panel an
   explicit hue-bucket legend (so a cell's POSITION has stated meaning,
   not just "looks colourful") and a per-cell hover readout (so the map
   reads as an interactive coverage instrument, not decoration).
   ============================================================ */

/** One tick on the hue-axis legend: a short label + its representative
 *  swatch hex (data, not a token — the legend mirrors the spectrum's own
 *  colours). */
export interface HueBucketTick {
  /** Short uppercase label, e.g. "RED". */
  label: string;
  /** Representative swatch hex for the bucket. */
  swatch: string;
}

/**
 * The fixed hue buckets the spectrum sweeps through, left→right. Mirrors
 * the FilterRail hue bands so the legend, the filter chips, and the cell
 * ordering all speak the same vocabulary. Pure constant — no DOM.
 */
export const HUE_BUCKET_TICKS: readonly HueBucketTick[] = [
  { label: "Red", swatch: "#ff3344" },
  { label: "Orange", swatch: "#ff8844" },
  { label: "Yellow", swatch: "#ffcc33" },
  { label: "Green", swatch: "#33dd66" },
  { label: "Cyan", swatch: "#33cccc" },
  { label: "Blue", swatch: "#3366ff" },
  { label: "Violet", swatch: "#7733cc" },
  { label: "Magenta", swatch: "#dd44aa" },
];

/** Short, human label for a cell's coverage state — used in the hover
 *  readout. Mirrors the dot legend (owned / wanted / none). */
export function coverageStateLabel(state: CoverageState): string {
  switch (state) {
    case "owned":
      return "owned";
    case "wanted":
      return "wanted";
    default:
      return "not owned";
  }
}

/**
 * The live hover readout for a cell, e.g.
 *   "Citadel · Mephiston Red · #9a1115 · owned"
 * `null` (pointer off the field) returns the resting hint so the line
 * never collapses to empty and jump its height. `effectiveState` is the
 * coverage state AFTER optimistic overrides, so the readout matches the
 * dot the user sees.
 */
export function cellHoverReadout(
  cell: CoverageCell | null,
  effectiveState?: CoverageState,
): string {
  if (!cell) return "Hover a cell to inspect · click to jump the list";
  const state = effectiveState ?? cell.state;
  return (
    cell.paint.brand +
    " · " +
    cell.paint.name +
    " · " +
    cell.paint.hex.toUpperCase() +
    " · " +
    coverageStateLabel(state)
  );
}

/**
 * Narrow the working set to the selected brands. `null` means "all
 * brands" (the unfiltered default seat) and returns the input untouched.
 * An array keeps only cells whose paint brand is in the set; an empty
 * array keeps nothing. Order is preserved.
 */
export function filterCellsByBrands(
  cells: readonly CoverageCell[],
  brands: readonly string[] | null,
): CoverageCell[] {
  if (brands === null) return cells.slice();
  const keep = new Set(brands);
  return cells.filter((c) => keep.has(c.paint.brand));
}

/**
 * Whether the current client is a coarse pointer or a narrow (< md, i.e.
 * < 768px) viewport — the "mobile" gate for the gap-fill bottom sheet
 * (UX-1301).
 *
 * Pure + SSR-safe: returns `false` when `window` is undefined so the
 * server render matches a desktop-first first paint, and the client
 * re-derives it in an effect. `md` = 768px to mirror the Tailwind
 * breakpoint the sheet styles branch on.
 */
export const MOBILE_MAX_WIDTH_PX = 768;

export function detectMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth < MOBILE_MAX_WIDTH_PX;
  return coarse || narrow;
}

/* ============================================================
   P17 / A1 — pixel-field cell sizing.
   ============================================================ */

/**
 * The fixed pixel cell edge (px). One value for the whole field — no
 * density branch. ~4px is literally pixel-sized so the full ~7,144-paint
 * library packs into a compact square that fits the calendar's footprint
 * (A1).
 */
export const CELL_MIN_PX = 4;

/**
 * LIB-COLORMAP-POLISH (1) — the desktop (lg+) minimum cell edge (px).
 *
 * The colour map only mounts inside the lg+ right-hand panel, where it has
 * a tall side column to itself. There, 4px pixels read as a cramped postage
 * stamp; this larger floor makes individual paints visible and — together
 * with `fillHeightLayout` — lets the spectrum grow to occupy the full panel
 * height instead of a small square. `CELL_MIN_PX` stays the compact 4px
 * floor used everywhere else.
 */
export const DESKTOP_CELL_MIN_PX = 9;

/**
 * The overlay-dot diameter (px) and its near-black ring width (px). A2:
 * the dot is an APPROXIMATE, at-a-glance marker, deliberately larger than
 * the 4px cell so it stays legible.
 *
 * LIB-COLORMAP-POLISH (3) — the dot now scales with the cell (see
 * `dotMetricsForCell`) so the bigger desktop pixels carry bigger, legible
 * markers; these constants remain the small-cell floor / fallback.
 */
export const DOT_SIZE_PX = 7;
export const DOT_RING_PX = 1;

/**
 * LIB-COLORMAP-POLISH (3) — dot diameter + ring width for a given cell
 * size, so the owned/wishlist markers grow with the bigger desktop pixels
 * and the ring (drawn in --color-bg, i.e. near-black) is thick enough to
 * separate the dot from a same-hue pixel underneath it.
 *
 * The dot fills most of the cell (so it's an obvious marker, not a speck)
 * but never shrinks below the small-cell floor. The ring scales with the
 * dot, clamped so it stays a clear outline at every size.
 */
export interface DotMetrics {
  /** Dot diameter in CSS px. */
  size: number;
  /** Ring (border) width in CSS px, drawn outside the dot. */
  ring: number;
}

export function dotMetricsForCell(cellSize: number): DotMetrics {
  // Aim for a dot a touch larger than the cell so it reads as a marker
  // sitting on the field; floor at the legacy 7px so tiny cells still show.
  const size = Math.max(DOT_SIZE_PX, Math.round(cellSize * 1.15));
  // Ring grows with the dot but stays a crisp 1–3px outline.
  const ring = Math.max(DOT_RING_PX, Math.min(3, Math.round(size * 0.22)));
  return { size, ring };
}

/* ============================================================
   A2 — sparse approximate ownership overlay.
   ============================================================ */

/**
 * Render one overlay dot per this many owned / wishlisted cells (in hue
 * order). 1 = a dot on every owned/wishlisted cell; higher = sparser.
 */
export const OVERLAY_SAMPLE_STRIDE = 8;

/**
 * Whether a given owned / wishlisted cell should carry an overlay dot,
 * sampling every `OVERLAY_SAMPLE_STRIDE`-th marked cell so the overlay
 * stays sparse + legible. `markedIndex` is the running count of marked
 * (owned OR wishlisted) cells seen so far in hue order — the FIRST marked
 * cell (index 0) always shows so a tiny collection isn't invisible.
 */
export function showsOverlayDot(
  markedIndex: number,
  stride: number = OVERLAY_SAMPLE_STRIDE,
): boolean {
  if (stride <= 0) throw new Error("stride must be positive");
  return markedIndex % stride === 0;
}

/* ============================================================
   M4.2 / D6.2 — canvas layout math (pure, unit-tested).

   All three functions are side-effect-free: no DOM access, no React.
   They translate a (count, widthPx, cellEdgePx) triple into the geometry
   the CollectionCanvas needs to paint and hit-test cells.
   ============================================================ */

/** Layout computed from the container width and minimum cell edge. */
export interface CanvasLayout {
  /** Number of columns (≥ 1). */
  cols: number;
  /** Number of rows (may be 0 when count is 0). */
  rows: number;
  /** Actual cell size in CSS px (= width / cols). */
  cellSize: number;
  /** Canvas CSS width in px. */
  width: number;
  /** Canvas CSS height in px (= rows * cellSize). */
  height: number;
}

/**
 * Compute the canvas layout for `count` cells in a container of
 * `widthPx` CSS pixels using `cellEdgePx` as the minimum cell edge.
 *
 *   cols = max(1, floor(width / cellEdge))
 *   cellSize = width / cols          — columns fill width exactly
 *   rows = ceil(count / cols)
 *   height = rows * cellSize
 */
export function computeCanvasLayout(
  count: number,
  widthPx: number,
  cellEdgePx: number,
): CanvasLayout {
  const cols = Math.max(1, Math.floor(widthPx / cellEdgePx));
  const cellSize = widthPx / cols;
  const rows = count === 0 ? 0 : Math.ceil(count / cols);
  const height = rows * cellSize;
  return { cols, rows, cellSize, width: widthPx, height };
}

/**
 * LIB-COLORMAP-POLISH (1) — height-filling layout for the desktop panel.
 *
 * `computeCanvasLayout` derives the grid from width alone, so the spectrum
 * always renders at its intrinsic (often short) height and leaves the tall
 * side panel mostly empty. This variant additionally takes the available
 * panel `heightPx` and grows the cell — by dropping columns — so the grid
 * fills that height without overflowing it.
 *
 * Algorithm: start dense (the most columns the width allows at the minimum
 * cell edge → the shortest grid) then remove columns one at a time. Fewer
 * columns ⇒ larger cells ⇒ more rows ⇒ a taller grid. Keep the layout with
 * the fewest columns (largest cells) whose height still fits `heightPx`. If
 * even the densest layout overflows (a huge catalog in a short panel), fall
 * back to the densest layout — the panel scrolls, exactly as before.
 *
 * Pure: no DOM, no React. `heightPx <= 0` (unmeasured) falls back to the
 * width-only layout so the first paint matches the legacy behaviour until
 * the ResizeObserver reports a real height.
 */
export function fillHeightLayout(
  count: number,
  widthPx: number,
  heightPx: number,
  cellEdgePx: number,
): CanvasLayout {
  const densest = computeCanvasLayout(count, widthPx, cellEdgePx);
  if (count === 0 || heightPx <= 0 || widthPx <= 0) return densest;

  // The densest layout already overflows the panel height — keep it (scrolls).
  if (densest.height > heightPx) return densest;

  let best = densest;
  // Drop columns (grow cells) while the grid still fits the panel height.
  for (let cols = densest.cols - 1; cols >= 1; cols--) {
    const cellSize = widthPx / cols;
    const rows = Math.ceil(count / cols);
    const height = rows * cellSize;
    if (height > heightPx) break; // any fewer cols is taller still — stop.
    best = { cols, rows, cellSize, width: widthPx, height };
  }
  return best;
}

/** Bounding rect (CSS px) of a cell at the given flat index. */
export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Return the CSS-px bounding rect of the cell at `index` in a given
 * layout. No bounds check — caller must ensure 0 ≤ index < count.
 */
export function cellRectAt(index: number, layout: CanvasLayout): CellRect {
  const col = index % layout.cols;
  const row = Math.floor(index / layout.cols);
  return {
    x: col * layout.cellSize,
    y: row * layout.cellSize,
    w: layout.cellSize,
    h: layout.cellSize,
  };
}

/**
 * Return the cell index at CSS-px coordinates (x, y) within the canvas,
 * or `null` if the point falls in the ragged last row beyond the last cell
 * (i.e. the computed index ≥ count).
 */
export function indexAtPoint(
  x: number,
  y: number,
  layout: CanvasLayout,
  count: number,
): number | null {
  if (layout.cellSize <= 0) return null;
  const col = Math.floor(x / layout.cellSize);
  const row = Math.floor(y / layout.cellSize);
  const index = row * layout.cols + col;
  if (index >= count) return null;
  return index;
}

/* ============================================================
   P16.5 — gap-fill surface view helpers.
   ============================================================ */

/** How many near-hue candidates the gap-fill surface offers. */
export const GAP_FILL_CANDIDATE_COUNT = 6;

/** One near-match row in the gap-fill surface: a paint + its live state. */
export interface GapFillCandidate {
  paint: Paint;
  state: CoverageState;
}

/**
 * The near-hue candidates for a tapped cell, nearest first, excluding the
 * tapped paint itself. Computed from the full cell set the client holds:
 * we rank the catalog paints by ΔE2000 via the frozen `nearestPaintsByHue`
 * then re-attach each candidate's coverage state so the surface can tag it
 * owned / wanted / none. `n` defaults to `GAP_FILL_CANDIDATE_COUNT`.
 */
export function buildGapFillCandidates(
  target: CoverageCell,
  allCells: readonly CoverageCell[],
  n: number = GAP_FILL_CANDIDATE_COUNT,
): GapFillCandidate[] {
  if (n <= 0) return [];
  const stateByPaintId = new Map<string, CoverageState>();
  const paints: Paint[] = [];
  for (const c of allCells) {
    stateByPaintId.set(c.paint.id, c.state);
    paints.push(c.paint);
  }
  return nearestPaintsByHue(target.paint, paints, n).map((paint) => ({
    paint,
    state: stateByPaintId.get(paint.id) ?? "none",
  }));
}

/**
 * Gap-fill heading copy, framed by whether the painter already owns the
 * tapped paint. Owned cells get a reassuring "you own this" frame (no nag
 * to buy); unowned cells get a "fill this gap" frame. The count is the
 * number of near matches shown.
 */
export function gapFillHeading(
  targetState: CoverageState,
  candidateCount: number,
): string {
  const matches =
    candidateCount === 1 ? "1 near match" : formatCount(candidateCount) + " near matches";
  if (targetState === "owned") {
    return "You own this — " + matches;
  }
  return "Fill this gap — " + matches;
}

/**
 * Short label for a candidate's coverage state, shown as a pill beside
 * each near-match row. Mirrors the legend (owned / wanted / none).
 */
export function candidateStateLabel(state: CoverageState): string {
  switch (state) {
    case "owned":
      return "Owned";
    case "wanted":
      return "Wanted";
    default:
      return "Not owned";
  }
}
