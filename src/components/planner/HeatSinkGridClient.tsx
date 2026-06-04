"use client";

/**
 * M4.2 / D6.2 — HeatSinkGridClient.
 *
 * Client wrapper for the COLLECTION map. Replaces the ~7,144-node DOM button
 * grid with a single <canvas> (CollectionCanvas) + a non-modal gap-fill
 * surface (CollectionGapFill). Page node count drops from ~7,144 to a handful.
 *
 * Layout:
 *   - Mobile (< 768px): canvas fills the widget; the gap-fill surface is a
 *     viewport-bottom sheet (portalled to body, driven by globals.css).
 *   - Desktop (≥ 768px): canvas left + gap-fill panel right (side-by-side flex).
 *     The panel is persistent: once open it stays until explicitly closed.
 *
 * Accessibility:
 *   - The canvas is role="img" with a summary aria-label.
 *   - A visible keyboard-focusable "Fill gaps / browse paints" button opens the
 *     gap-fill surface without a seed — keyboard users can reach every paint.
 *   - The gap-fill surface is role="dialog" aria-modal="false" (non-modal list
 *     panel) with its own search input and per-row actions.
 *
 * Optimistic overrides:
 *   - wantedOverrides: paints optimistically flipped to "wanted" this session.
 *   - ownedOverrides: paints optimistically flipped to "owned" this session.
 *   Both fold into stateForPaint so the canvas dots and gap-fill pills update
 *   without a server refetch.
 *
 * No raw hex in classNames. No cyan. No @ts-ignore. No any.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import type { CoverageGrid } from "@/db/queries/paintCoverage";
import type { CoverageCell } from "@/db/queries/paintCoverage";
import type { CoverageState } from "@/lib/paints/coverage";
import {
  coverageReadout,
  filterCellsByBrands,
  formatCount,
} from "./heatSinkHelpers";
import { CollectionCanvas } from "./CollectionCanvas";
import { CollectionGapFill } from "./CollectionGapFill";

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

  // Brand selection. null = "all brands" (no narrowing).
  const [selectedBrands, setSelectedBrands] = useState<ReadonlySet<
    string
  > | null>(() =>
    defaultBrandFilter === null ? null : new Set(defaultBrandFilter),
  );

  // Gap-fill surface state.
  // pickedCell: null = surface closed; a CoverageCell = opened from canvas tap.
  // gapFillOpen: true when opened via the keyboard "Fill gaps" button (null seed).
  const [pickedCell, setPickedCell] = useState<CoverageCell | null>(null);
  const [gapFillOpen, setGapFillOpen] = useState(false);

  // Single source of truth for which gap-fill placement to MOUNT. The surface
  // renders ONCE: a desktop in-flow right panel (≥768px) or a mobile bottom
  // sheet (<768px, portalled to body by the component). Rendering both behind
  // CSS `hidden`/`md:hidden` would double-mount — and on mobile BOTH would
  // portal to body (a portal escapes a `display:none` wrapper), stacking two
  // sheets. SSR-safe: starts false (desktop-first) and the surface only ever
  // mounts after a user interaction, so there is no hydration mismatch.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Optimistic overrides — fold into stateForPaint so dots + pills update
  // without a server refetch.
  const [wantedOverrides, setWantedOverrides] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [ownedOverrides, setOwnedOverrides] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Effective coverage state for a paint: optimistic owned/wanted wins over
  // the original (owned always beats wanted).
  const stateForPaint = useCallback(
    (paintId: string, fallback: CoverageState): CoverageState => {
      if (fallback === "owned" || ownedOverrides.has(paintId)) return "owned";
      return wantedOverrides.has(paintId) ? "wanted" : fallback;
    },
    [wantedOverrides, ownedOverrides],
  );

  const markWanted = useCallback((paintId: string) => {
    setWantedOverrides((prev) => {
      const next = new Set(prev);
      next.add(paintId);
      return next;
    });
  }, []);

  const markOwned = useCallback((paintId: string) => {
    setOwnedOverrides((prev) => {
      const next = new Set(prev);
      next.add(paintId);
      return next;
    });
  }, []);

  const brandFilterArray = useMemo<readonly string[] | null>(() => {
    if (selectedBrands === null) return null;
    if (selectedBrands.size === brands.length) return null;
    return Array.from(selectedBrands);
  }, [selectedBrands, brands.length]);

  const visibleCells = useMemo(
    () => filterCellsByBrands(cells, brandFilterArray),
    [cells, brandFilterArray],
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

  const handlePickCell = useCallback((cell: CoverageCell) => {
    setPickedCell(cell);
    setGapFillOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setPickedCell(null);
    setGapFillOpen(false);
  }, []);

  const gapFillVisible = gapFillOpen || pickedCell !== null;

  const summaryLabel =
    "Paint collection: " +
    formatCount(summary.owned) +
    " of " +
    formatCount(summary.total) +
    " owned, " +
    formatCount(summary.wanted) +
    " wanted";

  return (
    <div className="frame p-3 space-y-2 md:h-full md:flex md:flex-col md:min-h-0">
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
        aria-label="Filter by brand"
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

      {/* Canvas + gap-fill side panel (desktop) or bottom sheet (mobile). */}
      <div className="md:flex-1 md:min-h-0 md:flex md:gap-3">
        {/* Canvas column — fills all available width (flex-1 on desktop). */}
        <div className="min-w-0 flex-1">
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

          {/* Keyboard-focusable "Fill gaps" button — opens the surface with no
              seed so keyboard-only users can reach the full paint list. */}
          <button
            type="button"
            onClick={() => {
              setPickedCell(null);
              setGapFillOpen(true);
            }}
            className={clsx(
              "mt-2 tap-target w-full",
              "font-mono text-2xs uppercase tracking-[0.04em]",
              "border border-[var(--color-border-strong)] rounded-sm px-3 py-1.5",
              "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
              "hover:border-[var(--color-fg-muted)] transition-colors",
            )}
            aria-haspopup="dialog"
            aria-expanded={gapFillVisible}
          >
            Fill gaps · browse paints
          </button>
        </div>

        {/* Desktop right-panel: in-flow column, mounted only on ≥768px so the
            mobile instance can't also exist (see isMobile note above). */}
        {gapFillVisible && !isMobile ? (
          <div className="md:w-[280px] md:shrink-0 md:overflow-hidden">
            <CollectionGapFill
              allCells={cells}
              seedCell={pickedCell}
              stateForPaint={stateForPaint}
              onClose={handleClose}
              onMarkedWanted={markWanted}
              onMarkedOwned={markOwned}
            />
          </div>
        ) : null}
      </div>

      {/* Mobile gap-fill sheet — the single mobile mount. The component
          portals itself to document.body so the .gap-fill-sheet CSS rule
          (<768px) makes it a true viewport-bottom sheet. */}
      {gapFillVisible && isMobile ? (
        <CollectionGapFill
          allCells={cells}
          seedCell={pickedCell}
          stateForPaint={stateForPaint}
          onClose={handleClose}
          onMarkedWanted={markWanted}
          onMarkedOwned={markOwned}
        />
      ) : null}

      <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
        Your COLLECTION as a hue-sorted spectrum — the whole gamut, every
        paint a pixel. Green dots ≈ owned · yellow dots ≈ wishlisted (a
        sparse at-a-glance overlay, not pixel-precise).
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
