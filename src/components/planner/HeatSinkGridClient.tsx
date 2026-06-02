"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import type { CoverageGrid } from "@/db/queries/paintCoverage";
import {
  CELLS_PER_ROW_GROUP,
  borderClassFor,
  chunkCells,
  condensedCells,
  coverageReadout,
  filterCellsByBrands,
  formatCount,
  pickDefaultDensity,
  type GridDensity,
} from "./heatSinkHelpers";

/**
 * P16.4 — performance-pass client wrapper for the heat-sink grid.
 *
 * The server cell (`HeatSinkGridCell`) fetches the composed grid +
 * brand list + the painter's saved brand-filter default once and hands
 * them down here. This piece owns the interaction:
 *
 *   - **Brand filter** chip row — narrows the working set to the
 *     selected brands. Defaults to the painter's saved
 *     `library_brand_filter` (null = all). Cuts the node count.
 *   - **Condensed / Full toggle** — Condensed renders only owned+wanted
 *     cells (the painter's collection as a spectrum); Full renders the
 *     whole catalog. Default density is chosen from the summary so a
 *     painter with a real collection lands on Condensed.
 *   - **Row-chunking** — the visible set is split into row groups, each
 *     a `content-visibility:auto` + `contain-intrinsic-size` container
 *     so off-screen groups skip layout + paint. This is the headline
 *     fix for the 7,144-node render; the brand filter + condensed mode
 *     stack on top to shrink the set further.
 *
 * No raw hex (fills come from each paint's stored hex via inline style,
 * which is data, not a design token); borders use `@theme` tokens via
 * `borderClassFor`. The density toggle follows solid-fill Button
 * discipline — filled active chip, no `[ ]` brackets, no cyan.
 */

interface Props {
  grid: CoverageGrid;
  /** All brands in the catalog, sorted — the chip row. */
  brands: ReadonlyArray<string>;
  /** Painter's saved brand filter; null = all brands (no filter). */
  defaultBrandFilter: ReadonlyArray<string> | null;
}

export function HeatSinkGridClient({
  grid,
  brands,
  defaultBrandFilter,
}: Props) {
  const { cells, summary } = grid;

  // Brand selection. null = "all brands" (no narrowing). A Set drives
  // the chip toggles; null and "every brand selected" both render as
  // unfiltered.
  const [selectedBrands, setSelectedBrands] = useState<ReadonlySet<
    string
  > | null>(() =>
    defaultBrandFilter === null ? null : new Set(defaultBrandFilter),
  );

  const [density, setDensity] = useState<GridDensity>(() =>
    pickDefaultDensity(summary),
  );

  const brandFilterArray = useMemo<readonly string[] | null>(() => {
    if (selectedBrands === null) return null;
    // Every brand selected reads as "no filter" — keeps the full set.
    if (selectedBrands.size === brands.length) return null;
    return Array.from(selectedBrands);
  }, [selectedBrands, brands.length]);

  // Compose the visible set: density first (collection vs catalog),
  // then the brand filter. Memoized so toggling re-derives once.
  const visibleCells = useMemo(() => {
    const byDensity = density === "condensed" ? condensedCells(cells) : cells;
    return filterCellsByBrands(byDensity, brandFilterArray);
  }, [cells, density, brandFilterArray]);

  const rowGroups = useMemo(
    () => chunkCells(visibleCells, CELLS_PER_ROW_GROUP),
    [visibleCells],
  );

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) => {
      // From "all" → start an explicit set seeded with every brand,
      // then drop the toggled one so the first click narrows.
      const base = prev === null ? new Set(brands) : new Set(prev);
      if (base.has(brand)) base.delete(brand);
      else base.add(brand);
      return base;
    });
  };

  const isBrandActive = (brand: string): boolean =>
    selectedBrands === null || selectedBrands.has(brand);

  const allBrandsActive =
    selectedBrands === null || selectedBrands.size === brands.length;

  return (
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

      {/* Density toggle — Condensed (collection only) vs Full (catalog).
          Solid-fill discipline: active chip filled, inactive outlined.
          No cyan, no brackets. */}
      <div
        role="group"
        aria-label="Grid density"
        className="inline-flex items-center gap-2"
      >
        <DensityButton
          active={density === "condensed"}
          onClick={() => setDensity("condensed")}
          label="Condensed"
        />
        <DensityButton
          active={density === "full"}
          onClick={() => setDensity("full")}
          label="Full"
        />
      </div>

      {/* Brand-filter chip row — narrows the working set. "All" resets
          to the unfiltered seat; each brand chip toggles on/off. */}
      <div
        role="group"
        aria-label="Filter by brand"
        className="flex flex-wrap gap-1 max-h-24 overflow-y-auto"
      >
        <BrandChip
          active={allBrandsActive}
          onClick={() => setSelectedBrands(null)}
          label="All"
        />
        {brands.map((brand) => (
          <BrandChip
            key={brand}
            active={isBrandActive(brand)}
            onClick={() => toggleBrand(brand)}
            label={brand}
          />
        ))}
      </div>

      {/* The spectrum grid — split into row groups so off-screen groups
          skip layout/paint via content-visibility + contain-intrinsic-
          size. Each group is its own CSS grid; the auto-fill columns
          keep the spectrum packed at any width. */}
      <div
        role="grid"
        aria-label={
          "Paint coverage spectrum, " +
          formatCount(visibleCells.length) +
          " paints, hue-sorted"
        }
        data-cell-count={visibleCells.length}
        data-row-group-count={rowGroups.length}
        data-density={density}
        className="space-y-[1px]"
      >
        {rowGroups.length === 0 ? (
          <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug py-2">
            No paints match this filter. Re-add a brand or switch to Full
            to see the whole catalog.
          </p>
        ) : (
          rowGroups.map((group, groupIndex) => (
            <div
              key={groupIndex}
              role="row"
              data-row-group=""
              className="grid gap-[1px] [content-visibility:auto] [contain-intrinsic-size:auto_12px]"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(7px, 1fr))",
              }}
            >
              {group.map((cell) => (
                <span
                  key={cell.paint.id}
                  role="gridcell"
                  data-state={cell.state}
                  title={cell.paint.brand + " " + cell.paint.name}
                  aria-label={
                    cell.paint.brand + " " + cell.paint.name + ", " + cell.state
                  }
                  className={
                    "aspect-square rounded-[1px] border " +
                    borderClassFor(cell.state)
                  }
                  style={{ backgroundColor: cell.paint.hex }}
                />
              ))}
            </div>
          ))
        )}
      </div>

      <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
        Your paint collection as a hue-sorted spectrum. Green borders are
        owned, amber are on your wishlist. Condensed shows only your
        collection; Full shows the whole catalog.
      </p>
    </div>
  );
}

function DensityButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "tap-target inline-flex items-center justify-center px-3 py-1",
        "font-mono text-2xs font-bold uppercase tracking-[0.08em]",
        "border rounded-sm transition-colors",
        active
          ? "bg-[var(--color-green)] text-[var(--color-bg)] border-[var(--color-green)]"
          : "text-[var(--color-green)] border-[var(--color-green)] hover:bg-[color-mix(in_srgb,var(--color-green)_14%,transparent)]",
      )}
    >
      {label}
    </button>
  );
}

function BrandChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "inline-flex items-center justify-center px-2 py-0.5",
        "font-mono text-2xs uppercase tracking-[0.04em]",
        "border rounded-sm transition-colors truncate max-w-[10rem]",
        active
          ? "bg-[var(--color-amber)] text-[var(--color-bg)] border-[var(--color-amber)]"
          : "text-[var(--color-fg-muted)] border-[var(--color-border)] hover:border-[var(--color-amber)] hover:text-[var(--color-fg)]",
      )}
    >
      {label}
    </button>
  );
}
