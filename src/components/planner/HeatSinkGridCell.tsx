import { Card } from "@/components/ui/Card";
import { currentUserId } from "@/lib/auth-stub";
import {
  getCoverageGrid,
  type CoverageGrid,
} from "@/db/queries/paintCoverage";
import { borderClassFor, coverageReadout, formatCount } from "./heatSinkHelpers";

/**
 * P16.3 — HeatSink coverage grid widget.
 *
 * Renders the painter's whole paint catalog as a hue-sorted spectrum of
 * tiny squares: fill = each paint's stored hex, border = coverage state
 * (green owned / amber wanted / transparent none). The painter reads
 * their collection as a rainbow and sees the gaps at a glance.
 *
 * Header is a mono-caps readout — "1,204 / 7,144 owned · 312 wanted" —
 * plus a thin coverage bar. Tight density to sit alongside the other
 * PLANNER widgets in the right-hand stack.
 *
 * The hue-sort + per-cell coverage join lives in the server read layer
 * (`getCoverageGrid`); this component just maps over `grid.cells`. It's
 * an async server component that pulls its own data on a no-args call so
 * the PLANNER section mounts it as the unchanged `<HeatSinkGridCell />`.
 * `grid` is a test seam.
 *
 * Perf note: P16.3 only needs correct render. The 7,144-node hardening
 * (row-chunking, brand filter, condensed/full toggle, canvas fallback)
 * is P16.4. The cheap, trivially-safe `content-visibility:auto` on the
 * grid wrapper is the one perf hint applied here.
 */

interface Props {
  /** Optional pre-composed grid. When omitted the cell pulls the
   *  current user's coverage grid. Tests pin this for determinism. */
  grid?: CoverageGrid;
}

export async function HeatSinkGridCell({ grid }: Props = {}) {
  const resolved = grid ?? (await getCoverageGrid(await currentUserId()));
  const { cells, summary } = resolved;

  return (
    <Card title="COVERAGE" titleAs="h3" accentColor="green">
      <div className="frame p-3 space-y-2">
        {/* Header readout — mono-caps, tabular for the counts. */}
        <p
          className="text-xs font-sans uppercase tracking-wide tabular-nums text-[var(--color-fg-muted)]"
          aria-label={
            "Paint coverage: " +
            formatCount(summary.owned) +
            " of " +
            formatCount(summary.total) +
            " owned, " +
            formatCount(summary.wanted) +
            " wanted"
          }
        >
          {coverageReadout(summary)}
        </p>
        {/* Thin coverage bar — owned fraction of the catalog. */}
        <div
          className="h-1 w-full overflow-hidden rounded-[1px] bg-[color-mix(in_srgb,var(--color-fg-muted)_15%,transparent)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={summary.ownedPct}
          aria-label={summary.ownedPct + "% of the catalog owned"}
        >
          <div
            className="h-full bg-[var(--color-green)]"
            style={{ width: summary.ownedPct + "%" }}
          />
        </div>
        {/* The spectrum grid — fixed small cells, auto-fill columns so it
            packs tight at any width. content-visibility lets off-screen
            rows skip layout/paint (the one cheap P16.4-adjacent hint). */}
        <div
          role="grid"
          aria-label={
            "Paint coverage spectrum, " +
            formatCount(cells.length) +
            " paints, hue-sorted"
          }
          data-cell-count={cells.length}
          className="grid gap-[1px] [content-visibility:auto]"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(7px, 1fr))",
          }}
        >
          {cells.map((cell) => (
            <span
              key={cell.paint.id}
              role="gridcell"
              data-state={cell.state}
              title={cell.paint.brand + " " + cell.paint.name}
              aria-label={
                cell.paint.brand + " " + cell.paint.name + ", " + cell.state
              }
              className={
                "aspect-square rounded-[1px] border " + borderClassFor(cell.state)
              }
              style={{ backgroundColor: cell.paint.hex }}
            />
          ))}
        </div>
        <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
          Your paint collection as a hue-sorted spectrum. Green borders are
          owned, amber are on your wishlist.
        </p>
      </div>
    </Card>
  );
}
