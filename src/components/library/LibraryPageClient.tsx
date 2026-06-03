"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

import type { Paint } from "@/lib/paints/types";
import { applyAllFilters, countActiveFilters } from "@/lib/paints/filters";
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
  const activeFilterCount = useMemo(() => countActiveFilters(filter), [filter]);

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
      {/* Desktop rail — UX-1506: gated at lg (1024), not md (768). At md
          the rail + table together exceeded the 768 viewport (922px), so
          iPad-portrait scrolled sideways. Below lg the filters live in the
          bottom-sheet drawer and the table gets the full width. */}
      <div className="hidden lg:flex">
        <FilterRail paints={paints} filter={filter} />
      </div>

      {/* Mobile filter trigger. R7-5 — defensive sweep: also hidden at
          xl+ in case Ross's viewport sits at md/lg boundary widths where
          the desktop rail is visible AND this button leaks into the top
          right corner. Now hidden anywhere ≥ md (the rail's breakpoint)
          AND anywhere ≥ xl (defence-in-depth against future breakpoint
          drift). */}
      {/* M2 — no cyan on the filter trigger. Was variant="secondary"
          (solid cyan fill, reading as a primary CTA); flipped to a ghost
          outline so it reads as a disclosure affordance, not the page's
          main action. The active-filter count surfaces selection state by
          label, not hue. */}
      <Button
        type="button"
        onClick={() => setMobileFilterOpen(true)}
        variant="ghost"
        tone="outline"
        size="sm"
        className="lg:hidden fixed top-14 right-3 z-30"
        aria-label="Open filters"
        aria-expanded={mobileFilterOpen}
      >
        Filters
        {activeFilterCount > 0 ? (
          <span
            className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-sm bg-[var(--color-amber)] text-[var(--color-bg)] font-mono text-2xs leading-none"
            aria-hidden
          >
            {activeFilterCount}
          </span>
        ) : null}
        <span className="sr-only">
          {activeFilterCount > 0
            ? `, ${activeFilterCount} active`
            : ""}
        </span>
      </Button>

      {/* Mobile bottom-sheet drawer */}
      {mobileFilterOpen ? (
        <>
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setMobileFilterOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--color-bg)_70%,transparent)]"
          />
          <aside
            className="lg:hidden fixed inset-x-0 bottom-0 z-50 max-h-[80vh] flex flex-col border-t border-[var(--color-border-strong)] bg-[var(--color-bg-panel)] shadow-2xl"
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

      {/* UX-1506 — min-w-0 is load-bearing: as a flex child in the row
          flex above, the column's default `min-width:auto` refuses to
          shrink below the table's intrinsic content width, so the dense
          grid (and the mobile card's 44px toggle cluster) pushed the
          column past the viewport and the DOCUMENT scrolled sideways —
          even though the inner scroll div is overflow-x-hidden. min-w-0
          lets the column collapse to the viewport so the table's own
          truncation/clip can take effect. */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
          {/* M2 — always-visible Library search field. Typing a known
              paint name is faster than chip-hunting (recognition over
              recall on a 7,144-paint catalog). Writes the same `q` URL
              param the FilterRail's search box uses, so the two stay in
              sync. The View toggle sits to the right. */}
          <LibrarySearchField initial={filter.textQuery} />
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
 * M2 — always-visible Library search input. Debounced; writes the shared
 * `q` URL param (the same one `FilterRail`'s free-text box uses) so the
 * list filters by paint name/brand/sku without opening the filter sheet.
 */
function LibrarySearchField({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [local, setLocal] = useState(initial);

  // Keep in sync when the URL changes from elsewhere (e.g. the filter
  // sheet's own search box, or a global-search deep-link).
  useEffect(() => {
    setLocal(initial);
  }, [initial]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (local === initial) return;
      const params = new URLSearchParams(sp?.toString() ?? "");
      if (local.trim()) params.set("q", local);
      else params.delete("q");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <input
      type="search"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      placeholder="Search paints…"
      aria-label="Search the paint catalog"
      className={
        "flex-1 min-w-0 px-3 py-1.5 rounded-sm font-mono text-sm " +
        "bg-[var(--color-bg-panel)] text-[var(--color-fg)] frame " +
        "placeholder:text-[var(--color-fg-muted)] " +
        "focus:outline-2 focus:outline-[var(--color-accent)]"
      }
    />
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
