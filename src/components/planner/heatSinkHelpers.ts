/**
 * P16.3 / P17 — view-pure helpers for the HeatSink coverage grid cell.
 *
 * No React, no DB — unit-tested in isolation. Two jobs:
 *   - map a `CoverageState` to its OVERLAY-DOT colour-token class (owned →
 *     green dot, wanted → yellow dot, none → no dot — `@theme` tokens only,
 *     no raw hex, no cyan), and
 *   - format the header readout ("1,204 / 7,144 owned · 312 wanted").
 *
 * P17 redesign: the grid is a colour-space coverage MAP. EVERY catalog
 * paint (modulo the brand filter) renders as one tiny hue-sorted pixel,
 * forming a smooth spectrum field — the unowned pixels ARE the map of the
 * full gamut. Owned + wishlisted paints get an overlaid dot (green /
 * yellow, each with a near-black ring) so the painter's collection pops
 * against the field. There is no ownership BORDER and no density mode any
 * more — the field always shows the whole gamut.
 *
 * The hue-sort + coverage join itself lives in the server read layer
 * (`@/db/queries/paintCoverage`); the cell only consumes its output.
 */
import type { CoverageState } from "@/lib/paints/coverage";
import type { CoverageSummary } from "@/lib/paints/coverage";
import { nearestPaintsByHue } from "@/lib/paints/coverage";
import type { CoverageCell } from "@/db/queries/paintCoverage";
import type { Paint } from "@/lib/paints/types";

/**
 * Overlay-dot colour for a cell, keyed by coverage state. Owned → green
 * dot, wanted → yellow dot, none → no dot (the bare spectrum pixel). The
 * dot fill is a `@theme` token (never a raw hex, never cyan); a near-black
 * ring (`var(--color-bg)`) is applied at the call-site so the dot stays
 * legible against any underlying pixel colour. `null` means "render no
 * dot" — the pixel is just the paint's hue.
 */
export const COVERAGE_DOT_CLASS: Record<CoverageState, string | null> = {
  owned: "bg-[var(--color-green)]",
  wanted: "bg-[var(--color-yellow)]",
  none: null,
};

/** The dot fill class for a coverage state, or null for unowned (no dot). */
export function dotClassFor(state: CoverageState): string | null {
  return COVERAGE_DOT_CLASS[state];
}

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
   P16.4 / P17 — performance-pass view helpers.

   The catalog is ~7,144 pixel cells. A single flat CSS grid of 7,144
   nodes pays full layout + paint up-front and on every scroll. We
   mitigate, in order of cheapness, with:

     1. row-chunking (`chunkCells`) so the browser can skip off-screen
        groups via `content-visibility:auto` + `contain-intrinsic-size`,
     2. a brand filter (`filterCellsByBrands`) to cut the working set.

   P17 removed the condensed/full density mode entirely: the field ALWAYS
   shows every catalog paint (modulo the brand filter), because the
   unowned pixels are the map of the full gamut. The collection pops via
   overlaid dots, not by hiding the gaps.

   These are pure + unit-tested; the client wrapper composes them.
   ============================================================ */

/**
 * Cells per row group. Each group becomes one
 * `content-visibility:auto` container so the browser can skip layout +
 * paint for groups scrolled off-screen. ~100 keeps the group small
 * enough to skip cheaply yet large enough that we don't pay a wrapper
 * per handful of cells. Tuned, not load-bearing — exported so the
 * client + tests share one constant.
 */
export const CELLS_PER_ROW_GROUP = 100;

/**
 * Split an ordered cell list into fixed-size row groups. The last group
 * may be short. An empty input yields an empty list (no empty groups).
 * Order within + across groups is preserved so the hue spectrum reads
 * left-to-right, top-to-bottom unchanged.
 */
export function chunkCells(
  cells: readonly CoverageCell[],
  perGroup: number = CELLS_PER_ROW_GROUP,
): CoverageCell[][] {
  if (perGroup <= 0) throw new Error("perGroup must be positive");
  const groups: CoverageCell[][] = [];
  for (let i = 0; i < cells.length; i += perGroup) {
    groups.push(cells.slice(i, i + perGroup));
  }
  return groups;
}

/**
 * Number of row groups a cell list will produce at `perGroup`. Pure
 * count — cheaper than chunking when you only need the group total.
 */
export function rowGroupCount(
  cellCount: number,
  perGroup: number = CELLS_PER_ROW_GROUP,
): number {
  if (perGroup <= 0) throw new Error("perGroup must be positive");
  return Math.ceil(cellCount / perGroup);
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

   The grid is a colour-space COLLECTION map: every catalog paint is one
   literally-pixel-sized hue-sorted cell forming a smooth spectrum field,
   with owned / wishlisted paints marked by a SPARSE overlay dot. There is
   no density mode — one fixed tiny-cell size for the whole field.

   A1 (Ross 2026-06-03): BrushForge packs a whole library into a colour
   wheel; we pack ours into a compact SQUARE that fits the calendar's old
   footprint. The cell edge is now ~4px — literally pixel-sized — so all
   ~7,144 paints read as one dense gamut field rather than a wall of chunky
   squares. The previous 9px was still too big.

   Because the cell is now smaller than a legible dot, the ownership marker
   is NO LONGER one dot per owned/wishlisted pixel (that would smear into an
   unreadable mush at 4px). Instead A2 renders a SPARSE, APPROXIMATE overlay
   — a sampled subset of the owned / wishlisted cells get a dot that is
   allowed to be LARGER than its cell (it's an at-a-glance estimate of where
   the collection falls, not a pixel-precise tag). So the dot size is decic-
   oupled from the cell edge and intentionally exceeds it.

   The cell number is a CSS-grid column floor fed to
   `repeat(auto-fill, minmax(<floor>, 1fr))` — the `1fr` makes every
   column grow to consume leftover width, so a wider viewport packs more
   pixels rather than leaving side margin.
   ============================================================ */

/**
 * The fixed pixel cell edge (px). One value for the whole field — no
 * density branch. ~4px is literally pixel-sized so the full ~7,144-paint
 * library packs into a compact square that fits the calendar's footprint
 * (A1). Owned / wishlisted paints are marked by a SPARSE overlay dot
 * (A2), so the cell no longer has to be wide enough to hold a per-cell
 * dot.
 */
export const CELL_MIN_PX = 4;

/**
 * The overlay-dot diameter (px) and its near-black ring width (px). A2:
 * the dot is an APPROXIMATE, at-a-glance marker, deliberately larger than
 * the 4px cell so it stays legible — it estimates where owned / wishlisted
 * colours fall, it does not pixel-precisely tag one cell.
 */
export const DOT_SIZE_PX = 7;
export const DOT_RING_PX = 1;

/* ============================================================
   A2 — sparse approximate ownership overlay.

   At 4px a dot per owned/wishlisted cell would smear into noise. Instead
   we render a SPARSE sample: every Nth owned / wishlisted cell in hue
   order gets a dot. The painter sees the SHAPE of their collection (where
   the greens/yellows cluster + where the holes are) at a glance, which is
   all the brief asks — "density/precision secondary to small + legible".
   ============================================================ */

/**
 * Render one overlay dot per this many owned / wishlisted cells (in hue
 * order). 1 = a dot on every owned/wishlisted cell; higher = sparser.
 * Tuned for "at-a-glance estimate", not pixel precision.
 */
export const OVERLAY_SAMPLE_STRIDE = 8;

/**
 * Whether a given owned / wishlisted cell should carry an overlay dot,
 * sampling every `OVERLAY_SAMPLE_STRIDE`-th marked cell so the overlay
 * stays sparse + legible. `markedIndex` is the running count of marked
 * (owned OR wishlisted) cells seen so far in hue order — the FIRST marked
 * cell (index 0) always shows so a tiny collection isn't invisible.
 * Unowned cells never get a dot (they are the gamut map) and should not be
 * counted into `markedIndex` by the caller.
 */
export function showsOverlayDot(
  markedIndex: number,
  stride: number = OVERLAY_SAMPLE_STRIDE,
): boolean {
  if (stride <= 0) throw new Error("stride must be positive");
  return markedIndex % stride === 0;
}

/**
 * The `grid-template-columns` value for the pixel field — `auto-fill`
 * columns at the fixed cell edge, each growing to `1fr` so the row
 * consumes the full width (no wasted side margin). Returned as a string
 * for the inline grid style.
 */
export function gridColumnsFor(): string {
  return "repeat(auto-fill, minmax(" + CELL_MIN_PX + "px, 1fr))";
}

/**
 * The `contain-intrinsic-size` placeholder height (px) for an off-screen
 * row group — the browser reserves this while the group is skipped so
 * scroll position stays stable. Tracks the fixed cell edge so the reserved
 * space is in the right ballpark for the real rendered height.
 */
export function intrinsicRowSize(): number {
  return CELL_MIN_PX;
}

/* ============================================================
   P16.5 — gap-fill popover view helpers.

   Tapping a cell opens a popover anchored to it. The popover shows the
   tapped paint + its nearest-hue catalog neighbours ("candidates to fill
   this gap" / "close matches you already own"), each tagged with its own
   coverage state and offering a one-tap "Mark as wanted". All the data
   shaping is pure + unit-tested here; the client (HeatSinkGridClient)
   owns the interaction (popover open/close, the wishlist action call, and
   the optimistic border flip).

   Candidates come from the full catalog the client already holds —
   `grid.cells` always spans every catalog paint regardless of the
   Condensed/Full density toggle (density only narrows the *visible* set),
   so no extra server query is needed. A near match might be a paint the
   painter doesn't own yet (a "none" cell dropped in Condensed view), so
   we rank against every cell, not just the visible ones.
   ============================================================ */

/** How many near-hue candidates the gap-fill popover offers. */
export const GAP_FILL_CANDIDATE_COUNT = 6;

/** One near-match row in the gap-fill popover: a paint + its live state. */
export interface GapFillCandidate {
  paint: Paint;
  state: CoverageState;
}

/**
 * The near-hue candidates for a tapped cell, nearest first, excluding the
 * tapped paint itself. Computed from the full cell set the client holds:
 * we rank the catalog paints by ΔE2000 via the frozen `nearestPaintsByHue`
 * then re-attach each candidate's coverage state so the popover can tag it
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
 * Popover heading copy, framed by whether the painter already owns the
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
 * each near-match row. Mirrors the border legend (owned / wanted / none).
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
