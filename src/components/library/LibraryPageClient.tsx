"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import type { Paint } from "@/lib/paints/types";
import { applyAllFilters } from "@/lib/paints/filters";
import { sortPaints } from "@/lib/paints/sort";
import {
  filterFromSearchParams,
  sortFromSearchParams,
  selectedPaintFromSearchParams,
} from "@/lib/paints/filterUrl";
import { FilterRail } from "./FilterRail";
import { LibraryTable } from "./LibraryTable";
import { LibraryGrid } from "./LibraryGrid";
import { PaintDetailPanel } from "./PaintDetailPanel";
import { ViewModeToggle } from "./ViewModeToggle";
import { useLibraryViewMode } from "@/lib/hooks/useLibraryViewMode";
import { Button } from "@/components/ui/Button";

export interface InventorySnapshot {
  ownedCount: number;
  isWishlisted: boolean;
}

/**
 * Client wrapper that owns the interactive parts of the library page.
 * Keeps the page component (server) thin — just data fetch + a single
 * client island.
 */
export function LibraryPageClient({
  paints,
  inventory,
  defaultBrands,
}: {
  paints: ReadonlyArray<Paint>;
  inventory: ReadonlyMap<string, InventorySnapshot>;
  /** P12.19 — when the URL carries no `brand=...` param, fall back to
   *  this saved brand selection. The /user page's library-brand-filter
   *  card writes this through users.libraryBrandFilter. Empty array
   *  OR undefined both mean "all brands visible". */
  defaultBrands?: ReadonlyArray<string>;
}) {
  const sp = useSearchParams();

  const filter = useMemo(() => {
    const fromUrl = filterFromSearchParams(sp);
    // Apply the user's saved brand default only when the URL didn't
    // already specify a brand list — otherwise an in-page brand pick
    // would silently be overwritten on every render.
    if (fromUrl.brands.length === 0 && defaultBrands && defaultBrands.length > 0) {
      return { ...fromUrl, brands: [...defaultBrands] };
    }
    return fromUrl;
  }, [sp, defaultBrands]);
  const sortMode = useMemo(() => sortFromSearchParams(sp), [sp]);
  const selectedId = useMemo(() => selectedPaintFromSearchParams(sp), [sp]);

  const ownedCounts = useMemo(() => {
    const out = new Map<string, number>();
    inventory.forEach((v, k) => out.set(k, v.ownedCount));
    return out;
  }, [inventory]);

  const filtered = useMemo(
    () => sortPaints(applyAllFilters([...paints], filter, ownedCounts), sortMode),
    [paints, filter, ownedCounts, sortMode],
  );

  const selected = useMemo(
    () => (selectedId ? paints.find((p) => p.id === selectedId) ?? null : null),
    [paints, selectedId],
  );

  const similar = useMemo(
    () => (selected ? findSimilar(selected, [...paints]) : []),
    [selected, paints],
  );

  const selectedInventory = selected ? inventory.get(selected.id) : undefined;

  const [viewMode, setViewMode] = useLibraryViewMode();

  // Mobile-only state: bottom-sheet drawer for the filter rail.
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Auto-close the drawer once a filter actually changes (the user has
  // committed an intent and likely wants to see the result table).
  useEffect(() => {
    setMobileFilterOpen(false);
  }, [filter]);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Desktop rail */}
      <div className="hidden md:flex">
        <FilterRail paints={paints} filter={filter} />
      </div>

      {/* Mobile filter trigger. R7-5 — defensive sweep: also hidden at
          xl+ in case Ross's viewport sits at md/lg boundary widths where
          the desktop rail is visible AND this button leaks into the top
          right corner. Now hidden anywhere ≥ md (the rail's breakpoint)
          AND anywhere ≥ xl (defence-in-depth against future breakpoint
          drift). */}
      <Button
        type="button"
        onClick={() => setMobileFilterOpen(true)}
        variant="secondary"
        size="sm"
        className="md:hidden xl:hidden fixed top-14 right-3 z-30"
        aria-label="Open filters"
        aria-expanded={mobileFilterOpen}
      >
        Filters
      </Button>

      {/* Mobile bottom-sheet drawer */}
      {mobileFilterOpen ? (
        <>
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setMobileFilterOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--color-bg)_70%,transparent)]"
          />
          <aside
            className="md:hidden fixed inset-x-0 bottom-0 z-50 max-h-[80vh] flex flex-col border-t border-[var(--color-border-strong)] bg-[var(--color-bg-panel)] shadow-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
            aria-label="Library filters drawer"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-bg-panel)] z-10">
              <span className="font-mono text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                Filters
              </span>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="tap-target px-3 font-mono text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)]"
                aria-label="Close filters"
              >
                ×
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <FilterRail
                paints={paints}
                filter={filter}
                className="border-r-0"
                disableCollapse
              />
            </div>
          </aside>
        </>
      ) : null}

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
          <span className="font-mono text-2xs uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
            View
          </span>
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </div>
        {viewMode === "list" ? (
          <LibraryTable
            paints={filtered}
            selectedPaintId={selectedId}
            inventoryByPaint={inventory}
          />
        ) : (
          <LibraryGrid
            paints={filtered}
            selectedPaintId={selectedId}
            inventoryByPaint={inventory}
          />
        )}
      </div>
      <PaintDetailPanel
        paint={selected}
        similarInOtherBrands={similar}
        inventory={selectedInventory}
        allPaints={paints}
      />
    </div>
  );
}

/**
 * Cheap "similar in other brands" — sort by RGB distance and keep the
 * top 5 that are NOT from the same brand. The Tools/Match page in Phase
 * 4 will replace this with a proper ΔE2000 ranker.
 */
function findSimilar(target: Paint, all: Paint[]): Paint[] {
  const t = parseHex(target.hex);
  if (!t) return [];
  const scored: Array<{ p: Paint; d: number }> = [];
  for (const p of all) {
    if (p.brand === target.brand) continue;
    const rgb = parseHex(p.hex);
    if (!rgb) continue;
    const d =
      (rgb[0] - t[0]) * (rgb[0] - t[0]) +
      (rgb[1] - t[1]) * (rgb[1] - t[1]) +
      (rgb[2] - t[2]) * (rgb[2] - t[2]);
    scored.push({ p, d });
  }
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, 5).map((x) => x.p);
}

function parseHex(hex: string): [number, number, number] | null {
  const s = hex.startsWith("#") ? hex.slice(1) : hex;
  if (s.length !== 6) return null;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return [r, g, b];
}
