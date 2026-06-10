"use client";

import {
  useRef,
  useState,
  useLayoutEffect,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import type { Paint } from "@/lib/paints/types";
import type { SortMode } from "@/lib/paints/sort";
import { nearestVisibleIndex } from "@/lib/library/scrollTarget";
import { TypeIcon } from "./TypeIcon";
import { HexConfidenceDot } from "./HexConfidenceDot";
import { InventoryControls } from "./InventoryControls";
import { useDensity } from "@/lib/hooks/useDensity";
import { setOwnedCount, toggleWishlistedPaint } from "@/lib/actions/inventory";
import { useToast } from "@/components/ui/Toast";

// UX-1215 — the dense multi-column row truncated NAME to ambiguity on
// phones, so below 768 each row grows to a stacked card. Desktop keeps the
// dense table. D3 — desktop row height now tracks the global density lever
// (Comfortable 40 / Compact 32 [D §6, §9]); mobile stays the 64px card.
const ROW_HEIGHT_DESKTOP_COMFORTABLE = 40;
const ROW_HEIGHT_DESKTOP_COMPACT = 32;
const ROW_HEIGHT_MOBILE = 64;
const OVERSCAN = 8;

/** Tracks the `(max-width: 767px)` breakpoint so the virtualiser can
 *  size rows numerically. SSR-safe: starts false, syncs on mount. */
function useIsMobileLibrary(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);
  return isMobile;
}

/**
 * D3 — the desktop column order is identifier-first [D §9]: a checkbox,
 * the swatch, then **NAME**, then Brand · Line · Type · Hex · Own · ★.
 * (Before D3 the order led with Brand; the name is the human identifier so
 * it now leads.) SKU was demoted off the primary table — it lives in the
 * PaintDetailPanel — to keep the row scannable.
 *
 * 9 grid columns: select / swatch / name / brand / line / type / hex /
 * own / wanted. Every flexible column is minmax(0,…) / min-w-0 so it
 * shrinks instead of pushing siblings off (UX-1506).
 */
const GRID_CLASS =
  "md:grid-cols-[28px_24px_minmax(0,2fr)_110px_minmax(0,1fr)_24px_72px_36px_28px]";

/** D3 — which columns are sortable and the existing SortMode each maps to.
 *  Name → name, Brand → brand, Hex → hue (colour-wheel walk). Line / Type /
 *  Own have no underlying mode, so their headers are plain labels. */
const COLUMN_SORT: Partial<Record<string, SortMode>> = {
  name: "name",
  brand: "brand",
  hex: "hue",
};

/**
 * Dense library table with hand-rolled windowing. We render only the
 * visible row slice + a small overscan so 7k+ paints scroll on a phone.
 *
 * D3 adds the desktop power layer: sortable headers (aria-sort, 3-state
 * icon), a density-driven row height, bulk select (per-row checkbox +
 * 3-state Select-All + a batch-action bar), a right-click context menu,
 * and zebra striping — without losing the virtualisation.
 */
export function LibraryTable({
  paints,
  selectedPaintId,
  inventoryByPaint,
  scrollToPaintId,
  scrollToPaint,
  scrollNonce,
}: {
  paints: ReadonlyArray<Paint>;
  selectedPaintId: string | null;
  inventoryByPaint: ReadonlyMap<string, { ownedCount: number; isWishlisted: boolean }>;
  /** LIB-COLORMAP — paint to scroll the list to when the colour map is
   *  clicked. The nonce bumps on every map click so repeat clicks on the
   *  same hue re-trigger the scroll + flash. `scrollToPaint` is the full
   *  Paint (when known) so a filtered-out pick can fall back to the
   *  nearest in-list paint by hue. */
  scrollToPaintId?: string | null;
  scrollToPaint?: Paint | null;
  scrollNonce?: number;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [flashPaintId, setFlashPaintId] = useState<string | null>(null);
  const isMobile = useIsMobileLibrary();
  const [density] = useDensity();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();

  const desktopRowHeight =
    density === "compact"
      ? ROW_HEIGHT_DESKTOP_COMPACT
      : ROW_HEIGHT_DESKTOP_COMFORTABLE;
  const rowHeight = isMobile ? ROW_HEIGHT_MOBILE : desktopRowHeight;

  // D3 — current sort mode (from the URL `?sort=`). The header click
  // writes the param; the page re-sorts via sortPaints.
  const activeSort = (sp?.get("sort") ?? "brand") as SortMode;

  const handleSort = useCallback(
    (mode: SortMode) => {
      const params = new URLSearchParams(sp?.toString() ?? "");
      params.set("sort", mode);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, pathname, router],
  );

  // D3 — bulk selection. A Set of paint ids; select-all operates over the
  // currently-filtered `paints`. Cleared whenever the filtered set changes
  // so a stale selection can't leak across filters.
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const paintIdsKey = useMemo(
    () => paints.map((p) => p.id).join(","),
    [paints],
  );
  useEffect(() => {
    setSelected(new Set());
  }, [paintIdsKey]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = paints.length > 0 && selected.size === paints.length;
  const someSelected = selected.size > 0 && !allSelected;
  const toggleSelectAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === paints.length ? new Set() : new Set(paints.map((p) => p.id)),
    );
  }, [paints]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // D3 — right-click context menu state (anchored at the cursor).
  const [menu, setMenu] = useState<{
    paint: Paint;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener("click", close);
    document.addEventListener("scroll", close, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    setViewport(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // LIB-COLORMAP — scroll the virtualised list to a colour-map pick.
  // On nonce change, find the paint's index in the CURRENT (filtered)
  // `paints` array; if it's filtered out, fall back to the nearest in-list
  // paint by hue so the list still jumps to the right neighbourhood rather
  // than no-opping silently. Set scrollTop = index * rowHeight, then flash
  // the row briefly. The flash key drives a transient highlight class.
  useEffect(() => {
    if (!scrollToPaintId || scrollNonce == null) return;
    const el = scrollRef.current;
    if (!el) return;
    const targetIndex = nearestVisibleIndex(paints, scrollToPaintId, scrollToPaint);
    if (targetIndex < 0) return;
    const target = paints[targetIndex];
    if (!target) return;
    // Centre the row in the viewport where possible.
    const desired =
      targetIndex * rowHeight - Math.max(0, (el.clientHeight - rowHeight) / 2);
    el.scrollTop = Math.max(0, desired);
    setScrollTop(el.scrollTop);
    setFlashPaintId(target.id);
    const timer = setTimeout(() => setFlashPaintId(null), 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollNonce]);

  const totalHeight = paints.length * rowHeight;
  const visibleCount = Math.ceil(viewport / rowHeight) + OVERSCAN * 2;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const endIndex = Math.min(paints.length, startIndex + visibleCount);
  const slice = paints.slice(startIndex, endIndex);
  const offsetY = startIndex * rowHeight;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {selected.size > 0 ? (
        <BatchActionBar
          count={selected.size}
          onMarkOwned={async () => {
            const ids = Array.from(selected);
            await Promise.all(
              ids.map((id) => setOwnedCount({ paintId: id, count: 1 })),
            );
            toast.success(`Marked ${ids.length} paint(s) owned`);
            clearSelection();
            router.refresh();
          }}
          onMarkWanted={async () => {
            // toggleWishlistedPaint flips the flag, so only toggle paints
            // that aren't already wanted — never accidentally un-want one.
            const ids = Array.from(selected).filter(
              (id) => !inventoryByPaint.get(id)?.isWishlisted,
            );
            await Promise.all(
              ids.map((id) => toggleWishlistedPaint({ paintId: id })),
            );
            toast.success(`Marked ${ids.length} paint(s) wanted`);
            clearSelection();
            router.refresh();
          }}
          onClear={clearSelection}
        />
      ) : null}
      <TableHeader
        activeSort={activeSort}
        onSort={handleSort}
        allSelected={allSelected}
        someSelected={someSelected}
        onToggleAll={toggleSelectAll}
        rowCount={paints.length}
      />
      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        role="grid"
        aria-rowcount={paints.length}
        aria-colcount={9}
      >
        {paints.length === 0 ? (
          <div className="p-6">
            {/* Terminal empty-state panel — a framed module with a coordinate
                tag, so a zero-result read still feels like the OS reporting
                back, not a blank SaaS table. */}
            <div className="panel panel-ticks relative p-8 text-center">
              <span className="panel-label" aria-hidden>
                DB ▸ EMPTY
              </span>
              <p className="text-sm font-mono text-[var(--color-fg-muted)]">
                No paints match the current filters.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ height: totalHeight, position: "relative" }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {slice.map((p, i) => (
                <PaintRow
                  key={p.id}
                  paint={p}
                  rowIndex={startIndex + i}
                  active={p.id === selectedPaintId}
                  selected={selected.has(p.id)}
                  flash={p.id === flashPaintId}
                  onToggleSelect={() => toggleSelect(p.id)}
                  onContextMenu={(x, y) => setMenu({ paint: p, x, y })}
                  inventory={inventoryByPaint.get(p.id)}
                  rowHeight={rowHeight}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <TableFooter total={paints.length} selectedCount={selected.size} />

      {menu ? (
        <RowContextMenu
          paint={menu.paint}
          x={menu.x}
          y={menu.y}
          onMarkOwned={async () => {
            await setOwnedCount({ paintId: menu.paint.id, count: 1 });
            toast.success(`Marked ${menu.paint.name} owned`);
            setMenu(null);
            router.refresh();
          }}
          onMarkWanted={async () => {
            if (!inventoryByPaint.get(menu.paint.id)?.isWishlisted) {
              await toggleWishlistedPaint({ paintId: menu.paint.id });
            }
            toast.success(`Marked ${menu.paint.name} wanted`);
            setMenu(null);
            router.refresh();
          }}
          onCopyHex={async () => {
            try {
              await navigator.clipboard.writeText(menu.paint.hex);
              toast.success(`Copied ${menu.paint.hex}`);
            } catch {
              /* clipboard blocked — silent */
            }
            setMenu(null);
          }}
        />
      ) : null}
    </div>
  );
}

function TableHeader({
  activeSort,
  onSort,
  allSelected,
  someSelected,
  onToggleAll,
  rowCount,
}: {
  activeSort: SortMode;
  onSort: (mode: SortMode) => void;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  rowCount: number;
}) {
  return (
    <div
      className={clsx(
        // UX-1215 — the column header only makes sense for the dense
        // desktop table; the mobile card layout is self-labelling.
        "hidden md:grid items-center gap-3 px-3 py-1.5 border-b border-[var(--color-border-strong)] section-title m-0 bg-[var(--color-bg-elevated)]",
        GRID_CLASS,
      )}
      role="row"
    >
      {/* D3 — 3-state Select-All checkbox. */}
      <span role="columnheader" aria-colindex={1} className="flex items-center">
        <SelectAllCheckbox
          allSelected={allSelected}
          someSelected={someSelected}
          onToggle={onToggleAll}
          rowCount={rowCount}
        />
      </span>
      <span role="columnheader" aria-colindex={2} aria-hidden />
      <SortableHeader
        colIndex={3}
        label="Name"
        mode={COLUMN_SORT.name!}
        activeSort={activeSort}
        onSort={onSort}
      />
      <SortableHeader
        colIndex={4}
        label="Brand"
        mode={COLUMN_SORT.brand!}
        activeSort={activeSort}
        onSort={onSort}
      />
      <span role="columnheader" aria-colindex={5} className="hidden md:inline">
        Line
      </span>
      <span
        role="columnheader"
        aria-colindex={6}
        aria-label="Type"
      >
        T
      </span>
      <SortableHeader
        colIndex={7}
        label="Hex"
        mode={COLUMN_SORT.hex!}
        activeSort={activeSort}
        onSort={onSort}
      />
      <span
        role="columnheader"
        aria-colindex={8}
        className="text-center"
        aria-label="Owned"
      >
        Own
      </span>
      <span
        role="columnheader"
        aria-colindex={9}
        className="text-center"
        aria-label="Wanted"
      >
        ★
      </span>
    </div>
  );
}

/** D3 — sortable column header. aria-sort lives on the columnheader span;
 *  a 3-state icon (▲ active / ⇅ inactive) signifies sortability. The
 *  underlying SortMode sorts ascending, so the active state announces
 *  "ascending". */
function SortableHeader({
  colIndex,
  label,
  mode,
  activeSort,
  onSort,
}: {
  colIndex: number;
  label: string;
  mode: SortMode;
  activeSort: SortMode;
  onSort: (mode: SortMode) => void;
}) {
  const active = activeSort === mode;
  return (
    <span
      role="columnheader"
      aria-colindex={colIndex}
      aria-sort={active ? "ascending" : "none"}
      className="hidden md:inline"
    >
      <button
        type="button"
        onClick={() => onSort(mode)}
        // D8 — tooltip explains the sort affordance (mouse + keyboard
        // hover); cursor:pointer is implicit on the button.
        title={active ? `Sorted by ${label}` : `Sort by ${label}`}
        className={clsx(
          "tap-target inline-flex items-center gap-1 uppercase tracking-wider transition-colors motion-reduce:transition-none",
          active
            ? "text-[var(--color-amber)]"
            : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
        )}
      >
        {label}
        <span aria-hidden className="text-2xs">
          {active ? "▲" : "⇅"}
        </span>
      </button>
    </span>
  );
}

/** D3 — 3-state Select-All: unchecked / indeterminate (some) / checked
 *  (all). Sets the native `indeterminate` property via a ref since it
 *  isn't an attribute. */
function SelectAllCheckbox({
  allSelected,
  someSelected,
  onToggle,
  rowCount,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onToggle: () => void;
  rowCount: number;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected;
  }, [someSelected]);
  const label = allSelected
    ? `Deselect all ${rowCount} paints`
    : `Select all ${rowCount} paints`;
  // UX-011 — same fix as the row checkbox: a centred tap-target <label>
  // floors the select-all hit area to ≥24px (44px on touch) while the
  // native glyph keeps its size.
  return (
    <label className="tap-target inline-flex items-center justify-center cursor-pointer">
      <span className="sr-only">{label}</span>
      <input
        ref={ref}
        type="checkbox"
        checked={allSelected}
        onChange={onToggle}
        aria-label={label}
        // LIB-COLOR (2) — selection accent is green (matches the green
        // selected-row wash + "Mark owned" batch button); amber stays the
        // wishlist/wanted hue.
        className="accent-[var(--color-green)] cursor-pointer"
      />
    </label>
  );
}

/** D3 — batch-action bar. Appears when ≥1 row is selected [D §4, §9]. The
 *  actions reuse the existing inventory server actions; "Add to recipe"
 *  is deferred to the shared RecipeSlot work (M5/D5) and intentionally not
 *  surfaced here yet. No cyan on the actions. */
function BatchActionBar({
  count,
  onMarkOwned,
  onMarkWanted,
  onClear,
}: {
  count: number;
  onMarkOwned: () => void;
  onMarkWanted: () => void;
  onClear: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Batch actions"
      // LIB-COLOR (2) — the batch bar belongs to the selection idiom, so its
      // wash follows the green selection accent rather than amber (the
      // wishlist hue).
      className="flex items-center gap-3 px-3 py-2 border-b border-[var(--color-border-strong)] bg-[color-mix(in_srgb,var(--color-green)_10%,transparent)]"
    >
      <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg)] tabular-nums">
        {count} selected
      </span>
      <button
        type="button"
        onClick={onMarkOwned}
        className="tap-target font-mono text-2xs uppercase tracking-wider px-2 py-1 rounded-sm border border-[var(--color-green)] text-[var(--color-green)] hover:bg-[color-mix(in_srgb,var(--color-green)_12%,transparent)] transition-colors motion-reduce:transition-none"
      >
        Mark owned
      </button>
      <button
        type="button"
        onClick={onMarkWanted}
        className="tap-target font-mono text-2xs uppercase tracking-wider px-2 py-1 rounded-sm border border-[var(--color-amber)] text-[var(--color-amber)] hover:bg-[color-mix(in_srgb,var(--color-amber)_12%,transparent)] transition-colors motion-reduce:transition-none"
      >
        Mark wanted
      </button>
      <button
        type="button"
        onClick={onClear}
        className="tap-target ml-auto font-mono text-2xs uppercase tracking-wider px-2 py-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors motion-reduce:transition-none"
      >
        Clear
      </button>
    </div>
  );
}

/** D3 — right-click context menu (frequency-ordered, <12 items, also
 *  reachable via the toggles / batch bar) [D §4]. Fixed-positioned at the
 *  cursor; closes on outside click / Escape / scroll. */
function RowContextMenu({
  paint,
  x,
  y,
  onMarkOwned,
  onMarkWanted,
  onCopyHex,
}: {
  paint: Paint;
  x: number;
  y: number;
  onMarkOwned: () => void;
  onMarkWanted: () => void;
  onCopyHex: () => void;
}) {
  return (
    <div
      role="menu"
      aria-label={`Actions for ${paint.name}`}
      className="fixed z-50 min-w-[160px] frame-strong bg-[var(--color-bg-panel)] shadow-xl py-1"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <ContextMenuItem onClick={onMarkOwned}>Mark owned</ContextMenuItem>
      <ContextMenuItem onClick={onMarkWanted}>Mark wanted</ContextMenuItem>
      <ContextMenuItem onClick={onCopyHex}>Copy hex</ContextMenuItem>
    </div>
  );
}

function ContextMenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="tap-target w-full text-left px-3 py-2 font-mono text-xs uppercase tracking-wider text-[var(--color-fg)] hover:bg-[color-mix(in_srgb,var(--color-amber)_12%,transparent)] transition-colors motion-reduce:transition-none"
    >
      {children}
    </button>
  );
}

function PaintRow({
  paint,
  rowIndex,
  active,
  selected,
  flash,
  onToggleSelect,
  onContextMenu,
  inventory,
  rowHeight,
}: {
  paint: Paint;
  rowIndex: number;
  active: boolean;
  selected: boolean;
  /** LIB-COLORMAP — transient highlight after a colour-map scroll-to. */
  flash: boolean;
  onToggleSelect: () => void;
  onContextMenu: (x: number, y: number) => void;
  inventory: { ownedCount: number; isWishlisted: boolean } | undefined;
  rowHeight: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  function openDetail() {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("paint", paint.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function onRowKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail();
    }
  }

  // UX-1506 — layout is WIDTH-gated CSS (max-md card / md grid), correct on
  // every viewport regardless of when the JS breakpoint syncs.
  // D3 — zebra striping: odd rows get a faint tint (alongside the always-on
  // hover) so the eye tracks across a wide dense row [D §9].
  return (
    <div
      role="row"
      tabIndex={0}
      data-paint-id={paint.id}
      onClick={openDetail}
      onKeyDown={onRowKeyDown}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY);
      }}
      aria-rowindex={rowIndex + 1}
      aria-current={active ? "true" : undefined}
      aria-selected={selected}
      className={clsx(
        "caret-row",
        "w-full max-w-full overflow-hidden flex items-center md:grid gap-3 px-3 text-left font-mono text-xs cursor-pointer",
        "border-b border-[var(--color-border)]",
        rowIndex % 2 === 1 &&
          "bg-[color-mix(in_srgb,var(--color-fg)_2%,transparent)]",
        "hover:bg-[color-mix(in_srgb,var(--color-cyan)_6%,transparent)]",
        "focus:outline-none focus-visible:bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]",
        // FIGMA-REBUILD §4 — selected row = solid cyan fill + black text.
        active && "bg-[var(--color-cyan)] text-[var(--color-bg)]",
        // LIB-COLOR (2) — multi-select wash is GREEN, not amber. Amber/yellow
        // already carries the "wanted / wishlist" meaning across the Library
        // (the ★ toggle, the grid wishlist dot, the "Mark wanted" button), so
        // an amber selection wash read as an off-palette accent that collided
        // with that semantic. Green = "marked for a batch action" pairs with
        // the green "Mark owned" batch button and stays clear of the cyan
        // detail-active row (DESIGN_LANGUAGE §1's "cyan-highlighted row").
        selected &&
          "bg-[color-mix(in_srgb,var(--color-green)_12%,transparent)]",
        // LIB-COLORMAP — transient flash when the colour map scrolls here.
        // Token-based amber wash + ring; respects reduced motion.
        flash &&
          "animate-[pulse_0.6s_ease-in-out_2] bg-[color-mix(in_srgb,var(--color-amber)_18%,transparent)] ring-1 ring-inset ring-[var(--color-amber)] motion-reduce:animate-none",
        GRID_CLASS,
      )}
      style={{ height: rowHeight }}
    >
      {/* D3 — per-row select checkbox. Stops propagation so toggling
          selection doesn't open the detail panel. Hidden visual weight on
          the card layout (still present for selection).
          UX-011 — the bare ~14px checkbox was a sub-24px target. The glyph
          stays native (a 44px box would distort it), but a centred <label>
          tap-target spans the cell so the WHOLE cell toggles selection:
          ≥24px everywhere, 44px touch zone on mobile. */}
      <span
        role="gridcell"
        aria-colindex={1}
        className="flex items-center shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="tap-target inline-flex items-center justify-center w-full h-full cursor-pointer">
          <span className="sr-only">{`Select ${paint.name}`}</span>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${paint.name}`}
            // LIB-COLOR (2) — green selection accent (see select-all + wash).
            className="accent-[var(--color-green)] cursor-pointer"
          />
        </label>
      </span>

      {/* Swatch. */}
      <span
        role="gridcell"
        aria-colindex={2}
        aria-hidden
        className="h-8 w-8 md:h-5 md:w-5 shrink-0 rounded-sm border border-[var(--color-border)]"
        style={{ background: paint.hex }}
      />

      {/* Card body (≤md only): NAME on its own line, brand·type·hex beneath. */}
      <div className="md:hidden flex-1 min-w-0">
        <div
          className={clsx(
            "truncate text-sm leading-tight",
            active ? "text-[var(--color-bg)]" : "text-[var(--color-fg)]",
          )}
        >
          {paint.name}
        </div>
        <div
          className={clsx(
            "flex items-center gap-2 text-2xs leading-tight mt-0.5",
            active
              ? "text-[color-mix(in_srgb,var(--color-bg)_70%,transparent)]"
              : "text-[var(--color-fg-muted)]",
          )}
        >
          <span className="truncate max-w-[45%]">{paint.brand}</span>
          <span aria-hidden className="text-[var(--color-fg-muted)]">·</span>
          <span className="inline-flex items-center shrink-0">
            <TypeIcon type={paint.type} className="text-[var(--color-fg-muted)]" />
          </span>
          <span aria-hidden className="text-[var(--color-fg-muted)]">·</span>
          <span className="inline-flex items-center gap-1 uppercase shrink-0">
            <HexConfidenceDot confidence={paint.hexConfidence} source={paint.hexSource} />
            <span>{paint.hex.slice(1)}</span>
          </span>
        </div>
      </div>

      {/* Dense columns (≥md only) — D3 name-first order: name / brand /
          line / type / hex. */}
      <span
        role="gridcell"
        aria-colindex={3}
        className={clsx(
          "hidden md:inline truncate",
          active ? "text-[var(--color-bg)]" : "text-[var(--color-fg)]",
        )}
      >
        {paint.name}
      </span>
      <span
        role="gridcell"
        aria-colindex={4}
        className={clsx(
          "hidden md:inline truncate",
          active
            ? "text-[color-mix(in_srgb,var(--color-bg)_70%,transparent)]"
            : "text-[var(--color-fg-muted)]",
        )}
      >
        {paint.brand}
      </span>
      <span
        role="gridcell"
        aria-colindex={5}
        className={clsx(
          "hidden md:inline truncate",
          active
            ? "text-[color-mix(in_srgb,var(--color-bg)_55%,transparent)]"
            : "text-[var(--color-fg-subtle)]",
        )}
      >
        {paint.line ?? "—"}
      </span>
      <span role="gridcell" aria-colindex={6} className="hidden md:inline">
        <TypeIcon
          type={paint.type}
          className={
            active
              ? "text-[color-mix(in_srgb,var(--color-bg)_70%,transparent)]"
              : "text-[var(--color-fg-muted)]"
          }
        />
      </span>
      <span
        role="gridcell"
        aria-colindex={7}
        className={clsx(
          "hidden md:inline-flex items-center gap-1 uppercase min-w-0",
          active
            ? "text-[color-mix(in_srgb,var(--color-bg)_70%,transparent)]"
            : "text-[var(--color-fg-muted)]",
        )}
      >
        <HexConfidenceDot confidence={paint.hexConfidence} source={paint.hexSource} />
        <span className="truncate">{paint.hex.slice(1)}</span>
      </span>

      {/* Inventory toggles → two dense grid cells at md+ (md:contents). */}
      <div className="flex items-center gap-1 flex-none md:contents">
        <InventoryControls
          paintId={paint.id}
          initial={inventory}
          variant="compact"
        />
      </div>
    </div>
  );
}

function TableFooter({
  total,
  selectedCount,
}: {
  total: number;
  selectedCount: number;
}) {
  return (
    <div className="w-full max-w-full px-3 py-1.5 border-t border-[var(--color-border)] text-2xs font-mono text-[var(--color-fg-muted)] bg-[var(--color-bg-elevated)] flex items-center gap-3">
      <span>
        {total.toLocaleString()} paint{total === 1 ? "" : "s"}
      </span>
      {selectedCount > 0 ? (
        <span className="text-[var(--color-amber)] tabular-nums">
          · {selectedCount} selected
        </span>
      ) : null}
    </div>
  );
}
