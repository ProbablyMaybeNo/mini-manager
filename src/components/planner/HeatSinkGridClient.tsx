"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import type { CoverageGrid } from "@/db/queries/paintCoverage";
import type { CoverageState } from "@/lib/paints/coverage";
import {
  CELLS_PER_ROW_GROUP,
  chunkCells,
  coverageReadout,
  detectMobileViewport,
  dotClassFor,
  filterCellsByBrands,
  formatCount,
  gridColumnsFor,
  intrinsicRowSize,
  showsOverlayDot,
} from "./heatSinkHelpers";
import { HeatSinkGapFillPopover } from "./HeatSinkGapFillPopover";

/**
 * P16.4 / P17 / A — client wrapper for the heat-sink COLLECTION map.
 *
 * The server cell (`HeatSinkGridCell`) fetches the composed grid + brand
 * list + the painter's saved brand-filter default once and hands them
 * down here. This piece owns the interaction:
 *
 *   - **Brand filter** chip row — narrows the working set to the selected
 *     brands. Defaults to the painter's saved `library_brand_filter`
 *     (null = all). Cuts the node count.
 *   - **Row-chunking** — the visible set is split into row groups, each a
 *     `content-visibility:auto` + `contain-intrinsic-size` container so
 *     off-screen groups skip layout + paint. This is the headline fix for
 *     the ~7,144-node render; the brand filter stacks on top to shrink the
 *     set further.
 *
 * P17 redesign — the grid is a colour-space COLLECTION map, not a square
 * grid. EVERY catalog paint (modulo the brand filter) renders as ONE
 * literally-pixel-sized (~4px) hue-sorted cell, forming a smooth spectrum
 * FIELD: the unowned pixels ARE the map of the full gamut. The whole
 * ~7,144-paint library packs into a compact square that fits the
 * calendar's footprint (A1).
 *
 * A2 — owned + wishlisted paints are marked by a SPARSE, APPROXIMATE
 * overlay of dots (green for owned, yellow for wishlist, each with a
 * near-black ring). At 4px a dot per marked cell would smear into noise,
 * so only every Nth marked cell (in hue order) gets a dot, and the dot is
 * allowed to be larger than its cell — it estimates WHERE the collection
 * falls, not which exact pixel. The painter sees their collection + holes
 * at a glance. There is no density toggle and no ownership border.
 *
 * No raw hex (pixel fills come from each paint's stored hex via inline
 * style, which is data, not a design token); the overlay dots + their ring
 * use `@theme` tokens (`--color-green` / `--color-yellow` / `--color-bg`).
 * No cyan.
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

  // Brand selection. null = "all brands" (no narrowing). A Set drives the
  // chip toggles; null and "every brand selected" both render as
  // unfiltered.
  const [selectedBrands, setSelectedBrands] = useState<ReadonlySet<
    string
  > | null>(() =>
    defaultBrandFilter === null ? null : new Set(defaultBrandFilter),
  );

  // Coarse-pointer / narrow-viewport gate. SSR-safe: false on the server
  // and first paint (desktop-first), re-derived client-side in the effect
  // below. Drives the gap-fill bottom sheet (UX-1301).
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const sync = () => setIsMobile(detectMobileViewport());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  // P16.5 — gap-fill. `openPaintId` is the cell whose popover is open
  // (null = none). `wantedOverrides` holds paint ids optimistically
  // flipped to "wanted" this session so their dot appears yellow without a
  // server refetch; it's read back when re-tagging cells + candidates.
  const [openPaintId, setOpenPaintId] = useState<string | null>(null);
  const [wantedOverrides, setWantedOverrides] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Effective coverage state for a paint: an optimistic "wanted" flip wins
  // over the original (unless the painter already owned it). Drives both
  // the overlay dot and the popover's candidate tags.
  const stateForPaint = useCallback(
    (paintId: string, fallback: CoverageState): CoverageState => {
      if (fallback === "owned") return "owned";
      return wantedOverrides.has(paintId) ? "wanted" : fallback;
    },
    [wantedOverrides],
  );

  const markWanted = useCallback((paintId: string) => {
    setWantedOverrides((prev) => {
      const next = new Set(prev);
      next.add(paintId);
      return next;
    });
  }, []);

  const brandFilterArray = useMemo<readonly string[] | null>(() => {
    if (selectedBrands === null) return null;
    // Every brand selected reads as "no filter" — keeps the full set.
    if (selectedBrands.size === brands.length) return null;
    return Array.from(selectedBrands);
  }, [selectedBrands, brands.length]);

  // Compose the visible set: the whole gamut, narrowed only by the brand
  // filter. Every catalog paint is a pixel — the unowned ones are the map.
  const visibleCells = useMemo(
    () => filterCellsByBrands(cells, brandFilterArray),
    [cells, brandFilterArray],
  );

  const rowGroups = useMemo(
    () => chunkCells(visibleCells, CELLS_PER_ROW_GROUP),
    [visibleCells],
  );

  // A2 — sparse approximate overlay. Walk the visible cells in hue order,
  // counting the owned / wishlisted ones, and keep only every Nth marked
  // cell's id so the dots stay sparse + legible at the ~4px cell size. The
  // dot is an at-a-glance estimate of where the collection falls, not a
  // pixel-precise tag. Recomputed when the visible set or an optimistic
  // wishlist flip changes.
  const overlayDotIds = useMemo(() => {
    const ids = new Set<string>();
    let markedIndex = 0;
    for (const cell of visibleCells) {
      const effective = stateForPaint(cell.paint.id, cell.state);
      if (effective === "none") continue;
      if (showsOverlayDot(markedIndex)) ids.add(cell.paint.id);
      markedIndex += 1;
    }
    return ids;
  }, [visibleCells, stateForPaint]);

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) => {
      // From "all" → start an explicit set seeded with every brand, then
      // drop the toggled one so the first click narrows.
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
    <div className="frame p-3 space-y-2 md:h-full md:flex md:flex-col md:min-h-0">
      {/* Header readout — mono-caps, tabular for the counts. */}
      <p
        className="text-xs font-sans uppercase tracking-wide tabular-nums text-[var(--color-fg-muted)]"
        aria-label={
          "Paint collection: " +
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

      {/* Brand-filter chip row — narrows the working set. "All" resets to
          the unfiltered seat; each brand chip toggles on/off. */}
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

      {/* The spectrum field — every paint a tiny hue-sorted pixel, split
          into row groups so off-screen groups skip layout/paint via
          content-visibility + contain-intrinsic-size. Each group is its
          own CSS grid; the auto-fill columns keep the field packed at any
          width. Owned / wishlisted pixels carry an overlaid dot. */}
      <div
        role="grid"
        aria-label={
          "Paint collection spectrum, " +
          formatCount(visibleCells.length) +
          " paints, hue-sorted"
        }
        data-cell-count={visibleCells.length}
        data-row-group-count={rowGroups.length}
        className="space-y-[1px] md:flex-1 md:min-h-0 md:overflow-y-auto"
      >
        {rowGroups.length === 0 ? (
          <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug py-2">
            No paints match this filter. Re-add a brand to see the spectrum.
          </p>
        ) : (
          rowGroups.map((group, groupIndex) => (
            <div
              key={groupIndex}
              role="row"
              data-row-group=""
              data-cell-min={intrinsicRowSize()}
              className="grid gap-[1px] [content-visibility:auto]"
              style={{
                gridTemplateColumns: gridColumnsFor(),
                containIntrinsicSize: "auto " + intrinsicRowSize() + "px",
              }}
            >
              {group.map((cell) => {
                const effectiveState = stateForPaint(
                  cell.paint.id,
                  cell.state,
                );
                // A2 — only the sparse sampled subset of marked cells
                // carries a dot, so the overlay stays legible at ~4px.
                const dotClass = overlayDotIds.has(cell.paint.id)
                  ? dotClassFor(effectiveState)
                  : null;
                const isOpen = openPaintId === cell.paint.id;
                return (
                  <span
                    key={cell.paint.id}
                    className="relative aspect-square"
                  >
                    <button
                      type="button"
                      role="gridcell"
                      data-state={effectiveState}
                      aria-haspopup="dialog"
                      aria-expanded={isOpen}
                      title={cell.paint.brand + " " + cell.paint.name}
                      aria-label={
                        cell.paint.brand +
                        " " +
                        cell.paint.name +
                        ", " +
                        effectiveState +
                        ". Tap to fill this gap."
                      }
                      onClick={() =>
                        setOpenPaintId((prev) =>
                          prev === cell.paint.id ? null : cell.paint.id,
                        )
                      }
                      className={clsx(
                        "relative block h-full w-full rounded-[1px] cursor-pointer",
                        "hover:outline hover:outline-1 hover:outline-[var(--color-fg-muted)]",
                      )}
                      style={{ backgroundColor: cell.paint.hex }}
                    >
                      {/* Ownership marker (A2): a SPARSE sampled overlay —
                          only every Nth marked cell carries a centered dot
                          (green owned / yellow wishlist) with a 1px near-
                          black ring so it stays legible against any pixel.
                          Unowned pixels render no dot — they ARE the gamut
                          map. */}
                      {dotClass ? (
                        <span
                          aria-hidden
                          data-dot={effectiveState}
                          className={clsx(
                            // A2: a ~7px disc — intentionally larger than
                            // the 4px cell — centered + overflowing so the
                            // sparse marker stays legible against any pixel.
                            "pointer-events-none absolute left-1/2 top-1/2 z-10",
                            "h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full",
                            "shadow-[0_0_0_1px_var(--color-bg)]",
                            dotClass,
                          )}
                        />
                      ) : null}
                    </button>
                    {isOpen ? (
                      <HeatSinkGapFillPopover
                        cell={cell}
                        allCells={cells}
                        isMobile={isMobile}
                        stateForPaint={stateForPaint}
                        onClose={() => setOpenPaintId(null)}
                        onMarkedWanted={markWanted}
                      />
                    ) : null}
                  </span>
                );
              })}
            </div>
          ))
        )}
      </div>

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
        // P16.6 (UX-1210): a real ≥44px-tappable chip. `tap-target`
        // gives the touch floor (44px, 32px on md+); the label wraps
        // cleanly inside (`whitespace-normal text-left`) instead of
        // clipping at the right edge, and there's no fixed max-width to
        // truncate it. Reads as a chip, not prose.
        // UX-1315: a clear resting affordance — a solid border + a faint
        // panel-tint fill so each chip reads as a discrete tappable chip,
        // not a wrapping prose list. The active chip flips to the solid
        // amber fill (distinct selected state); inactive keeps the tinted
        // resting fill with a stronger border so it still looks pressable.
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
