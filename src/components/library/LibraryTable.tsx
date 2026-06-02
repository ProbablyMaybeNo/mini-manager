"use client";

import { useRef, useState, useLayoutEffect, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import type { Paint } from "@/lib/paints/types";
import { TypeIcon } from "./TypeIcon";
import { HexConfidenceDot } from "./HexConfidenceDot";
import { InventoryControls } from "./InventoryControls";

// UX-1215 — the dense 40px multi-column row truncated NAME to ambiguity
// on phones ("3b Au …"). Below 768 each row grows to a 64px stacked card
// (NAME on its own full-width line, then brand · type · hex beneath) so
// adjacent paints stay distinguishable. Desktop keeps the dense table.
// The virtualiser needs a single numeric height, so we pick one per
// breakpoint via matchMedia rather than CSS alone.
const ROW_HEIGHT_DESKTOP = 40;
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
 * Dense library table with hand-rolled windowing. We render only the
 * visible row slice + a small overscan so 7k+ paints scroll on a phone.
 * No external windowing dep — the surface is simple enough to live
 * inline.
 */
export function LibraryTable({
  paints,
  selectedPaintId,
  inventoryByPaint,
}: {
  paints: ReadonlyArray<Paint>;
  selectedPaintId: string | null;
  inventoryByPaint: ReadonlyMap<string, { ownedCount: number; isWishlisted: boolean }>;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);
  const isMobile = useIsMobileLibrary();
  const rowHeight = isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    setViewport(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const totalHeight = paints.length * rowHeight;
  const visibleCount = Math.ceil(viewport / rowHeight) + OVERSCAN * 2;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const endIndex = Math.min(paints.length, startIndex + visibleCount);
  const slice = paints.slice(startIndex, endIndex);
  const offsetY = startIndex * rowHeight;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <TableHeader />
      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        role="grid"
        aria-rowcount={paints.length}
        aria-colcount={9}
      >
        {paints.length === 0 ? (
          <div className="p-8 text-center text-sm font-mono text-[var(--color-fg-muted)]">
            No paints match the current filters.
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
                  inventory={inventoryByPaint.get(p.id)}
                  rowHeight={rowHeight}
                  isMobile={isMobile}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <TableFooter total={paints.length} />
    </div>
  );
}

function TableHeader() {
  return (
    <div
      className={clsx(
        // UX-1215 — the column header only makes sense for the dense
        // desktop table; the mobile card layout is self-labelling, so
        // hide the header strip below md.
        "hidden md:grid items-center gap-3 px-3 py-1.5 border-b border-[var(--color-border-strong)] section-title m-0 bg-[var(--color-bg-elevated)]",
        GRID_CLASS,
      )}
      role="row"
    >
      <span role="columnheader" aria-colindex={1} aria-hidden />
      <span role="columnheader" aria-colindex={2}>Brand</span>
      <span role="columnheader" aria-colindex={3} className="hidden md:inline">Line</span>
      <span role="columnheader" aria-colindex={4}>Name</span>
      <span role="columnheader" aria-colindex={5} className="hidden md:inline">SKU</span>
      <span role="columnheader" aria-colindex={6} aria-label="Type">T</span>
      <span role="columnheader" aria-colindex={7}>Hex</span>
      <span role="columnheader" aria-colindex={8} className="text-center" aria-label="Owned">
        Own
      </span>
      <span role="columnheader" aria-colindex={9} className="text-center" aria-label="Wanted">
        ★
      </span>
    </div>
  );
}

/**
 * Desktop (≥md) dense 9-col grid: swatch / brand / line / name / sku /
 * type / hex / owned / wanted. Below md the LibraryTable renders the
 * stacked card layout (see PaintRow's `isMobile` branch — UX-1215), so
 * this grid only governs the desktop table now. UX-910's earlier
 * mobile-grid rebalance is superseded by the card layout, which gives
 * NAME a full line and removes the truncation-to-ambiguity entirely.
 */
const GRID_CLASS =
  "md:grid-cols-[24px_110px_minmax(0,1fr)_minmax(0,2fr)_80px_24px_72px_36px_28px]";

function PaintRow({
  paint,
  rowIndex,
  active,
  inventory,
  rowHeight,
  isMobile,
}: {
  paint: Paint;
  rowIndex: number;
  active: boolean;
  inventory: { ownedCount: number; isWishlisted: boolean } | undefined;
  rowHeight: number;
  isMobile: boolean;
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

  // UX-1506 (Round 15) — the layout used to be gated on the `isMobile` JS
  // boolean, which starts false on SSR/first paint, so the dense desktop
  // GRID_CLASS rendered on phones and overflowed (431px @ 375). The
  // structural layout is now driven purely by WIDTH-based CSS
  // (`max-md:`/`md:`) so it's correct on every viewport regardless of when
  // (or whether) the JS breakpoint syncs. `isMobile` is kept only to size
  // the virtualiser row height numerically — a brief mismatch there is just
  // extra vertical whitespace, never horizontal overflow.
  //
  // - max-md (≤767): stacked CARD — swatch · {NAME line / brand·type·hex
  //   line} · toggles. NAME gets its own full-width line (UX-1215).
  // - md+ (≥768): dense 9-col grid (GRID_CLASS). Every flexible column is
  //   min-w-0 / minmax(0,…) so it shrinks instead of pushing siblings off.
  return (
    <div
      role="row"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={onRowKeyDown}
      aria-rowindex={rowIndex + 1}
      aria-current={active ? "true" : undefined}
      className={clsx(
        "caret-row",
        // Card (flex) below md, dense grid at md+. overflow-hidden is the
        // belt-and-braces guarantee that a row can never push content past
        // the viewport edge (UX-1506 §1.4.10 reflow).
        "w-full max-w-full overflow-hidden flex items-center md:grid gap-3 px-3 text-left font-mono text-xs cursor-pointer",
        "border-b border-[var(--color-border)]",
        "hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]",
        "focus:outline-none focus-visible:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)]",
        active && "bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]",
        GRID_CLASS,
      )}
      style={{ height: rowHeight }}
    >
      {/* Swatch — bigger on the card (8) so it anchors the stacked row,
          5 in the dense grid. */}
      <span
        role="gridcell"
        aria-colindex={1}
        aria-hidden
        className="h-8 w-8 md:h-5 md:w-5 shrink-0 rounded-sm border border-[var(--color-border)]"
        style={{ background: paint.hex }}
      />

      {/* Card body (≤md only): NAME on its own line, brand·type·hex beneath.
          Hidden at md+ where the dense columns take over. */}
      <div className="md:hidden flex-1 min-w-0">
        <div
          className={clsx(
            "truncate text-sm leading-tight",
            active ? "text-[var(--color-accent)]" : "text-[var(--color-fg)]",
          )}
        >
          {paint.name}
        </div>
        <div className="flex items-center gap-2 text-2xs text-[var(--color-fg-muted)] leading-tight mt-0.5">
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

      {/* Dense columns (≥md only) — hidden on the card so the row doesn't
          carry duplicate text. */}
      <span
        role="gridcell"
        aria-colindex={2}
        className="hidden md:inline text-[var(--color-fg-muted)] truncate"
      >
        {paint.brand}
      </span>
      <span role="gridcell" aria-colindex={3} className="hidden md:inline truncate text-[var(--color-fg-subtle)]">
        {paint.line ?? "—"}
      </span>
      <span
        role="gridcell"
        aria-colindex={4}
        className={clsx(
          "hidden md:inline truncate",
          active ? "text-[var(--color-accent)]" : "text-[var(--color-fg)]",
        )}
      >
        {paint.name}
      </span>
      <span role="gridcell" aria-colindex={5} className="hidden md:inline truncate text-[var(--color-fg-subtle)] text-2xs">
        {paint.sku ?? ""}
      </span>
      <span role="gridcell" aria-colindex={6} className="hidden md:inline">
        <TypeIcon type={paint.type} className="text-[var(--color-fg-muted)]" />
      </span>
      <span role="gridcell" aria-colindex={7} className="hidden md:inline-flex items-center gap-1 uppercase text-[var(--color-fg-muted)] min-w-0">
        <HexConfidenceDot confidence={paint.hexConfidence} source={paint.hexSource} />
        <span className="truncate">{paint.hex.slice(1)}</span>
      </span>

      {/* Inventory toggles — pinned right on the card (ml-auto), own two
          grid cells at md+. shrink-0 so they never compress to the glyph. */}
      <div className="flex items-center gap-1 shrink-0 ml-auto md:ml-0 md:contents">
        <InventoryControls
          paintId={paint.id}
          initial={inventory}
          variant="compact"
        />
      </div>
    </div>
  );
}

function TableFooter({ total }: { total: number }) {
  return (
    <div className="px-3 py-1.5 border-t border-[var(--color-border)] text-2xs font-mono text-[var(--color-fg-muted)] bg-[var(--color-bg-elevated)]">
      {total.toLocaleString()} paint{total === 1 ? "" : "s"}
    </div>
  );
}

