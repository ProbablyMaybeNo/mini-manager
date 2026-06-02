/**
 * P16.3 — view-pure helpers for the HeatSink coverage grid cell.
 *
 * No React, no DB — unit-tested in isolation. Two jobs:
 *   - map a `CoverageState` to its border-token class (green / amber /
 *     transparent — `@theme` tokens only, no raw hex, no cyan), and
 *   - format the header readout ("1,204 / 7,144 owned · 312 wanted").
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
 * Border colour for a cell, keyed by coverage state. Owned → green,
 * wanted → amber, none → transparent. `@theme` tokens only so the
 * border tracks the palette; never a raw hex, never cyan.
 */
export const COVERAGE_BORDER_CLASS: Record<CoverageState, string> = {
  owned: "border-[var(--color-green)]",
  wanted: "border-[var(--color-amber)]",
  none: "border-transparent",
};

export function borderClassFor(state: CoverageState): string {
  return COVERAGE_BORDER_CLASS[state];
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
   P16.4 — performance-pass view helpers.

   The catalog is ~7,144 bordered cells. A single flat CSS grid of
   7,144 nodes pays full layout + paint up-front and on every scroll.
   We mitigate, in order of cheapness, with:

     1. row-chunking (`chunkCells`) so the browser can skip off-screen
        groups via `content-visibility:auto` + `contain-intrinsic-size`,
     2. a brand filter (`filterCellsByBrands`) to cut the working set,
     3. a condensed/full mode (`condensedCells` + `pickDefaultDensity`)
        that defaults to the painter's own collection when it's big
        enough to read as a spectrum.

   These are pure + unit-tested; the client wrapper composes them.
   ============================================================ */

/** Density mode for the grid. */
export type GridDensity = "condensed" | "full";

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
 * Below this many owned+wanted paints, the painter's collection is too
 * sparse to read as a spectrum, so the grid defaults to Full (the whole
 * catalog). At or above it, Condensed (collection-only) is the more
 * useful default. Threshold = 60 owned/wanted paints — roughly two
 * starter sets — which is where the condensed spectrum starts to look
 * like a colour field rather than a scatter of squares.
 */
export const CONDENSED_DEFAULT_THRESHOLD = 60;

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
 * Condensed view: only the painter's actual collection — owned + wanted
 * cells — rendered as a spectrum. "none" cells (the gaps) drop out.
 * Order preserved so the kept cells still ramp through the hue sort.
 */
export function condensedCells(
  cells: readonly CoverageCell[],
): CoverageCell[] {
  return cells.filter((c) => c.state !== "none");
}

/**
 * Default density for a painter: Condensed once their collection
 * (owned + wanted) clears `CONDENSED_DEFAULT_THRESHOLD`, else Full so a
 * near-empty collection still shows something to fill. Driven by the
 * summary so it costs nothing extra.
 */
export function pickDefaultDensity(summary: CoverageSummary): GridDensity {
  return summary.owned + summary.wanted >= CONDENSED_DEFAULT_THRESHOLD
    ? "condensed"
    : "full";
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
