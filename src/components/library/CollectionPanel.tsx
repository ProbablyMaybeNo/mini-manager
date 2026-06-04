"use client";

/**
 * LIB-COLORMAP — the library page's persistent right-hand colour map.
 *
 * "Map = navigator. List = workbench. Detail = on row-click." This panel
 * is a NAVIGATOR: it shows the full-library hue-sorted pixel spectrum
 * (reusing CollectionCanvas) + a sparse owned/wishlist dot overlay, plus
 * the summary readout / coverage bar / legend / brand-chip row. Clicking a
 * map cell does NOT open a popup or select a paint — it calls
 * `onScrollToPaint(paintId)`, which scrolls + flashes that hue section in
 * the main list.
 *
 * The dots stay LIVE: `stateForPaint` overlays the shared inventory
 * overrides store (mirrored from each row's optimistic InventoryControls
 * toggle) on top of the server-computed cell state, so marking a paint
 * owned/wanted updates the map without a refetch.
 *
 * The summary / coverage-bar / legend / brand-chip markup is COPIED from
 * the planner's collection-map client (not imported) per the locked
 * design — this panel is the library home for the map; the planner copy is
 * being removed in the follow-up commit.
 *
 * Token colours only (var(--color-*)); no cyan; no raw hex in classNames
 * (canvas reads hex from paint data + tokens via getComputedStyle).
 */

import { useCallback, useMemo, useState } from "react";
import { clsx } from "clsx";

import type { CoverageCell } from "@/db/queries/paintCoverage";
import type { CoverageState, CoverageSummary } from "@/lib/paints/coverage";
import { CollectionCanvas } from "@/components/planner/CollectionCanvas";
import {
  coverageReadout,
  filterCellsByBrands,
  formatCount,
} from "@/components/planner/heatSinkHelpers";
import { useInventoryOverrides } from "./inventoryOverrides";

interface Props {
  /** Hue-sorted coverage cells for the whole catalog. */
  cells: ReadonlyArray<CoverageCell>;
  /** Catalog-wide owned/wanted/total summary for the header readout. */
  summary: CoverageSummary;
  /** All brands in the catalog, sorted — the chip row. */
  brands: ReadonlyArray<string>;
  /** Scroll + flash the given paint's hue section in the main list. */
  onScrollToPaint: (paintId: string) => void;
}

export function CollectionPanel({
  cells,
  summary,
  brands,
  onScrollToPaint,
}: Props) {
  const overrides = useInventoryOverrides();

  // Brand selection. null = "all brands" (no narrowing).
  const [selectedBrands, setSelectedBrands] = useState<ReadonlySet<
    string
  > | null>(null);

  const brandFilterArray = useMemo<readonly string[] | null>(() => {
    if (selectedBrands === null) return null;
    if (selectedBrands.size === brands.length) return null;
    return Array.from(selectedBrands);
  }, [selectedBrands, brands.length]);

  const visibleCells = useMemo(
    () => filterCellsByBrands(cells, brandFilterArray),
    [cells, brandFilterArray],
  );

  // Live dot state: overlay the shared optimistic overrides store on top of
  // the server cell state. Owned beats wanted beats none — matching the
  // coverageFor() precedence so a toggled-owned paint reads as owned even if
  // also wishlisted.
  const stateForPaint = useCallback(
    (paintId: string, fallback: CoverageState): CoverageState => {
      const snap = overrides?.get(paintId);
      if (!snap) return fallback;
      if (snap.ownedCount > 0) return "owned";
      if (snap.isWishlisted) return "wanted";
      return "none";
    },
    [overrides],
  );

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) => {
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

  const handlePickCell = useCallback(
    (cell: CoverageCell) => {
      onScrollToPaint(cell.paint.id);
    },
    [onScrollToPaint],
  );

  const summaryLabel =
    "Paint collection: " +
    formatCount(summary.owned) +
    " of " +
    formatCount(summary.total) +
    " owned, " +
    formatCount(summary.wanted) +
    " wanted";

  return (
    <div className="frame p-3 space-y-2 h-full flex flex-col min-h-0">
      {/* Header readout — mono-caps, tabular for the counts. */}
      <p
        className="text-xs font-sans uppercase tracking-wide tabular-nums text-[var(--color-fg-muted)]"
        aria-label={summaryLabel}
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

      {/* Legend — what the dots mean against the spectrum field. */}
      <p
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-sans text-[var(--color-fg-muted)]"
        aria-label="Legend: green dot is owned, yellow dot is wishlisted"
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-green)] shadow-[0_0_0_1px_var(--color-bg)]"
          />
          owned
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-yellow)] shadow-[0_0_0_1px_var(--color-bg)]"
          />
          wishlisted
        </span>
      </p>

      {/* Brand-filter chip row */}
      <div
        role="group"
        aria-label="Filter the map by brand"
        className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1"
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

      {/* The pixel spectrum — the navigator. Clicking a cell scrolls the
          main list to that paint's hue section (no popup, no selection). */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {visibleCells.length === 0 ? (
          <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug py-2">
            No paints match this filter. Re-add a brand to see the spectrum.
          </p>
        ) : (
          <CollectionCanvas
            cells={visibleCells}
            summaryLabel={summaryLabel}
            stateForPaint={stateForPaint}
            onPickCell={handlePickCell}
          />
        )}
      </div>

      <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
        Your library as a hue-sorted spectrum — every paint a pixel. Click a
        region to jump the list to that hue. Green dots ≈ owned · yellow dots
        ≈ wishlisted (a sparse at-a-glance overlay, not pixel-precise).
      </p>
    </div>
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
        "tap-target inline-flex items-center justify-center px-2.5 py-1.5",
        "font-mono text-2xs uppercase tracking-[0.04em] leading-tight",
        "whitespace-normal text-center break-words",
        "border rounded-sm transition-colors",
        active
          ? "bg-[var(--color-amber)] text-[var(--color-bg)] border-[var(--color-amber)] font-bold"
          : "bg-[color-mix(in_srgb,var(--color-fg-muted)_8%,transparent)] text-[var(--color-fg-muted)] border-[var(--color-border-strong)] hover:border-[var(--color-amber)] hover:text-[var(--color-fg)]",
      )}
    >
      {label}
    </button>
  );
}
