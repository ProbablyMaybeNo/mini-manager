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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";

import type { CoverageCell } from "@/db/queries/paintCoverage";
import type { CoverageState, CoverageSummary } from "@/lib/paints/coverage";
import { CollectionCanvas } from "./CollectionCanvas";
import {
  DESKTOP_CELL_MIN_PX,
  HUE_BUCKET_TICKS,
  cellHoverReadout,
  coverageReadout,
  filterCellsByBrands,
  formatCount,
} from "./heatSinkHelpers";
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

  // Number of brands currently included by the filter (all = the catalog).
  const selectedBrandCount = allBrandsActive
    ? brands.length
    : (selectedBrands?.size ?? 0);

  const handlePickCell = useCallback(
    (cell: CoverageCell) => {
      onScrollToPaint(cell.paint.id);
    },
    [onScrollToPaint],
  );

  // UX-009 — the cell currently under the pointer, driving the live hover
  // readout below the spectrum. null = resting (shows the inspect/jump hint).
  const [hoverCell, setHoverCell] = useState<CoverageCell | null>(null);
  const hoverReadout = useMemo(() => {
    const effective = hoverCell
      ? stateForPaint(hoverCell.paint.id, hoverCell.state)
      : undefined;
    return cellHoverReadout(hoverCell, effective);
  }, [hoverCell, stateForPaint]);

  const summaryLabel =
    "Paint collection: " +
    formatCount(summary.owned) +
    " of " +
    formatCount(summary.total) +
    " owned, " +
    formatCount(summary.wanted) +
    " wanted";

  return (
    // Terminal "memory / coverage" module — the colour map framed as a
    // mission-control panel (DESIGN_LANGUAGE §7): phosphor border + corner
    // ticks via `.panel`/`.panel-ticks`, with a MEM ▸ COVERAGE coordinate
    // tag on the top border. The phosphor border is supplied by the
    // `.panel` CSS rule, not a colour token in this file (the colour map's
    // contract bans the cyan token in the component source).
    <div className="panel panel-ticks relative p-3 pt-4 space-y-2 h-full flex flex-col min-h-0">
      <span className="panel-label" aria-hidden>
        MEM ▸ COVERAGE
      </span>
      {/* Header readout — mono-caps, tabular for the counts. */}
      <p
        className="text-xs font-mono uppercase tracking-wide tabular-nums text-[var(--color-fg-muted)]"
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

      {/* UX-009 — cell-meaning legend. The audit flagged the spectrum as
          reading like decoration: it had a DOT legend but never said what a
          CELL encodes. State it plainly first ("each cell = one paint;
          position = hue"), then the owned/wishlisted dot key. Mono-caps to
          match the terminal module language. */}
      <p className="text-2xs font-mono uppercase tracking-wide leading-snug text-[var(--color-fg-muted)]">
        Each cell = one paint · position = hue
      </p>
      <p
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs font-mono uppercase tracking-wide text-[var(--color-fg-muted)]"
        aria-label="Legend: green dot is owned, yellow dot is wishlisted"
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-full bg-[var(--color-green)] shadow-[0_0_0_1.5px_var(--color-bg)]"
          />
          owned
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-full bg-[var(--color-yellow)] shadow-[0_0_0_1.5px_var(--color-bg)]"
          />
          wishlisted
        </span>
      </p>

      {/* UX-009 — hue-axis bucket labels. The spectrum sweeps these buckets
          left→right, top→bottom; spelling them out gives a cell's POSITION
          stated meaning so the graphic earns its space. Decorative swatches
          carry data hex (the bucket's own colour), not a token — same
          contract as the canvas. */}
      <ul
        aria-label="Hue buckets, in spectrum order"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs font-mono uppercase tracking-wide text-[var(--color-fg-subtle)] m-0 p-0 list-none"
      >
        {HUE_BUCKET_TICKS.map((tick) => (
          <li key={tick.label} className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-[1px]"
              style={{ background: tick.swatch }}
            />
            <span>{tick.label.slice(0, 3)}</span>
          </li>
        ))}
      </ul>

      {/* LIB-COLORMAP-POLISH (2) — brand filter as a compact checkbox
          dropdown. The old wrapping chip row could eat ~5 rows of vertical
          space; collapsing it to a single "Brands (N)" trigger reclaims
          that height for the map. Same behaviour: multi-select brands with
          an "All" default. */}
      <BrandFilterDropdown
        brands={brands}
        allBrandsActive={allBrandsActive}
        selectedBrandCount={selectedBrandCount}
        isBrandActive={isBrandActive}
        onToggleBrand={toggleBrand}
        onSelectAll={() => setSelectedBrands(null)}
      />

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
            onHoverCell={setHoverCell}
            cellMinPx={DESKTOP_CELL_MIN_PX}
            fillHeight
          />
        )}
      </div>

      {/* UX-009 — live hover readout. Hovering a cell names the paint it
          encodes (brand · name · hex · coverage state); resting shows the
          inspect/jump hint. aria-live=polite so screen readers hear the
          identified paint without stealing focus. tabular-nums keeps the
          hex from jittering as it updates. */}
      <p
        aria-live="polite"
        className="min-h-[1.5em] text-2xs font-mono uppercase tracking-wide tabular-nums leading-snug text-[var(--color-fg)] truncate"
      >
        {hoverReadout}
      </p>

      <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
        Click a region to jump the list to that hue. Dots are a sparse
        at-a-glance ownership overlay, not pixel-precise.
      </p>
    </div>
  );
}

/**
 * LIB-COLORMAP-POLISH (2) — compact brand filter.
 *
 * A single "Brands (N)" trigger that opens a scrollable checkbox checklist
 * (an "All" reset row + one row per brand). Replaces the old wrapping chip
 * row to reclaim vertical space for the map. Behaviour is unchanged:
 * multi-select brands, "All" as the default. Outside-click + Escape close,
 * mirroring the WishlistToolsMenu disclosure pattern. Token colours only.
 */
function BrandFilterDropdown({
  brands,
  allBrandsActive,
  selectedBrandCount,
  isBrandActive,
  onToggleBrand,
  onSelectAll,
}: {
  brands: ReadonlyArray<string>;
  allBrandsActive: boolean;
  selectedBrandCount: number;
  isBrandActive: (brand: string) => boolean;
  onToggleBrand: (brand: string) => void;
  onSelectAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerLabel = allBrandsActive
    ? "Brands · All"
    : "Brands · " + formatCount(selectedBrandCount);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Filter the map by brand"
        className={clsx(
          "tap-target w-full inline-flex items-center justify-between gap-2 px-2.5 py-1.5",
          "font-mono text-2xs uppercase tracking-[0.04em] leading-tight",
          "border rounded-sm transition-colors text-left",
          allBrandsActive
            ? "bg-[color-mix(in_srgb,var(--color-fg-muted)_8%,transparent)] text-[var(--color-fg-muted)] border-[var(--color-border-strong)] hover:text-[var(--color-fg)] hover:border-[var(--color-amber)]"
            : "bg-[var(--color-amber)] text-[var(--color-bg)] border-[var(--color-amber)] font-bold",
        )}
      >
        <span className="truncate">{triggerLabel}</span>
        <span aria-hidden className="shrink-0">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Brand filter options"
          className="absolute left-0 right-0 top-full mt-1 z-30 max-h-56 overflow-y-auto frame-strong bg-[var(--color-bg-panel)] shadow-xl py-1"
        >
          <BrandCheckItem
            checked={allBrandsActive}
            onToggle={onSelectAll}
            label="All brands"
            emphasise
          />
          <div
            role="separator"
            aria-hidden
            className="my-1 h-px bg-[var(--color-border)]"
          />
          {brands.map((brand) => (
            <BrandCheckItem
              key={brand}
              checked={isBrandActive(brand)}
              onToggle={() => onToggleBrand(brand)}
              label={brand}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BrandCheckItem({
  checked,
  onToggle,
  label,
  emphasise = false,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  emphasise?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onToggle}
      className={clsx(
        "tap-target w-full flex items-center gap-2 px-2.5 py-1.5 text-left",
        "font-mono text-2xs uppercase tracking-[0.04em] leading-tight",
        "hover:bg-[color-mix(in_srgb,var(--color-amber)_12%,transparent)]",
        emphasise
          ? "text-[var(--color-fg)] font-bold"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-[2px] border text-2xs leading-none",
          checked
            ? "bg-[var(--color-amber)] text-[var(--color-bg)] border-[var(--color-amber)]"
            : "bg-transparent border-[var(--color-border-strong)]",
        )}
      >
        {checked ? "✓" : ""}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
