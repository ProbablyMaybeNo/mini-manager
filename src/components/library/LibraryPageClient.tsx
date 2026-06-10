"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

import type { Paint } from "@/lib/paints/types";
import type { CoverageCell } from "@/db/queries/paintCoverage";
import type { CoverageSummary } from "@/lib/paints/coverage";
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
import { CollectionPanel } from "./CollectionPanel";
import { InventoryOverridesProvider } from "./inventoryOverrides";
import { useLibraryViewMode } from "@/lib/hooks/useLibraryViewMode";
import { Button } from "@/components/ui/Button";
import { SlideOutPanel } from "@/components/ui/SlideOutPanel";

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
  coverageCells,
  coverageSummary,
  brands,
}: {
  paints: ReadonlyArray<Paint>;
  inventory: ReadonlyMap<string, InventorySnapshot>;
  /** P12.19 — when the URL carries no `brand=...` param, fall back to
   *  this saved brand selection. The /user page's library-brand-filter
   *  card writes this through users.libraryBrandFilter. Empty array
   *  OR undefined both mean "all brands visible". */
  defaultBrands?: ReadonlyArray<string>;
  /** LIB-COLORMAP — hue-sorted coverage cells for the right-hand map. */
  coverageCells?: ReadonlyArray<CoverageCell>;
  /** LIB-COLORMAP — catalog-wide owned/wanted summary for the map header. */
  coverageSummary?: CoverageSummary;
  /** LIB-COLORMAP — all catalog brands, sorted, for the map's chip row. */
  brands?: ReadonlyArray<string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
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

  // LIB-COLORMAP — the colour-map's "scroll the list to this hue" target.
  // The nonce bumps on every map click so repeat clicks on the same paint
  // re-fire the scroll + flash in the (memoised) table/grid effect.
  const [scrollTarget, setScrollTarget] = useState<{
    paintId: string;
    nonce: number;
  } | null>(null);

  const onScrollToPaint = useCallback((paintId: string) => {
    setScrollTarget((prev) => ({ paintId, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  const scrollTargetPaint = useMemo(
    () =>
      scrollTarget
        ? paints.find((p) => p.id === scrollTarget.paintId) ?? null
        : null,
    [scrollTarget, paints],
  );

  const [filterOpen, setFilterOpen] = useState(false);

  function clearAllFilters() {
    const params = new URLSearchParams(sp?.toString() ?? "");
    for (const key of [
      "brand",
      "line",
      "type",
      "hue",
      "owned",
      "hex",
      "q",
    ]) {
      params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <InventoryOverridesProvider>
    <div className="flex flex-1 min-h-0">
      <SlideOutPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        breadcrumb="SYS &gt; FILTER"
        title="FILTER"
        side="left"
        width={320}
      >
        <FilterRail
          paints={paints}
          filter={filter}
          className="border-r-0"
          disableCollapse
        />
      </SlideOutPanel>

      {/* UX-1506 — min-w-0 is load-bearing: as a flex child in the row
          flex above, the column's default `min-width:auto` refuses to
          shrink below the table's intrinsic content width, so the dense
          grid (and the mobile card's 44px toggle cluster) pushed the
          column past the viewport and the DOCUMENT scrolled sideways —
          even though the inner scroll div is overflow-x-hidden. min-w-0
          lets the column collapse to the viewport so the table's own
          truncation/clip can take effect. */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]">
          {/* Terminal module tag — a tiny coordinate caption anchors the
              toolbar as a mission-control surface (lg+ only so it never
              crowds the search on phones). */}
          <span
            aria-hidden
            className="hidden lg:inline shrink-0 font-mono text-2xs uppercase tracking-[0.14em] text-[var(--color-cyan)]"
          >
            DB ▸ CATALOG
          </span>
          {/* M2 — always-visible Library search field. Typing a known
              paint name is faster than chip-hunting (recognition over
              recall on a 7,144-paint catalog). Writes the same `q` URL
              param the FilterRail's search box uses, so the two stay in
              sync. The View toggle sits to the right. */}
          <LibrarySearchField initial={filter.textQuery} />
          <Button
            type="button"
            variant="ghost"
            tone="outline"
            size="sm"
            onClick={() => setFilterOpen(true)}
            aria-expanded={filterOpen}
          >
            Filter
            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
          {activeFilterCount > 0 ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={clearAllFilters}
            >
              Clear filter
            </Button>
          ) : null}
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </div>
        {viewMode === "list" ? (
          <LibraryTable
            paints={filtered}
            selectedPaintId={selectedId}
            inventoryByPaint={inventory}
            scrollToPaintId={scrollTarget?.paintId ?? null}
            scrollToPaint={scrollTargetPaint}
            scrollNonce={scrollTarget?.nonce}
          />
        ) : (
          <LibraryGrid
            paints={filtered}
            selectedPaintId={selectedId}
            inventoryByPaint={inventory}
            scrollToPaintId={scrollTarget?.paintId ?? null}
            scrollToPaint={scrollTargetPaint}
            scrollNonce={scrollTarget?.nonce}
          />
        )}
      </div>

      {/* LIB-COLORMAP — persistent right-hand colour map (lg+ only).
          Map = navigator: clicking a region scrolls the list to that hue.
          Mounted only when no paint is selected; when a paint IS selected
          the PaintDetailPanel (fixed inset-y-0 right-0) overlays + covers
          it — that's "the map gets replaced by the detail slide-out". The
          mobile library layout is intentionally unchanged. */}
      {selectedId === null &&
      coverageCells &&
      coverageSummary &&
      brands ? (
        <aside
          className="hidden lg:flex w-[320px] shrink-0 border-l border-[var(--color-border)] p-2 min-h-0"
          aria-label="Collection colour map"
        >
          <CollectionPanel
            cells={coverageCells}
            summary={coverageSummary}
            brands={brands}
            onScrollToPaint={onScrollToPaint}
          />
        </aside>
      ) : null}

      <PaintDetailPanel
        paint={selected}
        similarInOtherBrands={similar}
        inventory={selectedInventory}
        allPaints={paints}
      />
    </div>
    </InventoryOverridesProvider>
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

  // Terminal command-prompt search — a cyan ▸ prompt + a phosphor-tinted
  // frame matching the dashboard filter idiom, so the Library's primary
  // search reads as a CLI input, not a generic SaaS search box.
  return (
    <label
      className="flex-1 min-w-0 rounded-sm border flex items-center gap-2 px-3 py-1.5 focus-within:border-[var(--color-cyan)] transition-colors motion-reduce:transition-none"
      style={{
        borderColor:
          "color-mix(in srgb, var(--color-cyan) 22%, var(--color-border))",
      }}
    >
      <span aria-hidden className="font-mono text-xs text-[var(--color-cyan)]">
        ▸
      </span>
      <span className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] hidden sm:inline">
        Search
      </span>
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Filter paints by name, brand, SKU…"
        aria-label="Search the paint catalog"
        className="flex-1 min-w-0 bg-transparent font-mono text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
      />
    </label>
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
