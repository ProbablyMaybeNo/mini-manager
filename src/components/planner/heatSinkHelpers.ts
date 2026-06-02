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
