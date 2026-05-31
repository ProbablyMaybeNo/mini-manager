"use client";

import { useRef, useState, useLayoutEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import type { Paint } from "@/lib/paints/types";
import { TypeIcon } from "./TypeIcon";
import { HexConfidenceDot } from "./HexConfidenceDot";
import { InventoryControls } from "./InventoryControls";

const ROW_HEIGHT = 40; // px — fixed so the virtualiser can do simple math
const OVERSCAN = 8;

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

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    setViewport(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const totalHeight = paints.length * ROW_HEIGHT;
  const visibleCount = Math.ceil(viewport / ROW_HEIGHT) + OVERSCAN * 2;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(paints.length, startIndex + visibleCount);
  const slice = paints.slice(startIndex, endIndex);
  const offsetY = startIndex * ROW_HEIGHT;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <TableHeader />
      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="flex-1 min-h-0 overflow-y-auto"
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
        "grid items-center gap-3 px-3 py-1.5 border-b border-[var(--color-border-strong)] section-title m-0 bg-[var(--color-bg-elevated)]",
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
      <span role="columnheader" aria-colindex={9} className="text-center" aria-label="Wishlisted">
        ★
      </span>
    </div>
  );
}

/**
 * Mobile collapses to swatch / brand / name / type / hex / owned /
 * wishlisted — Line + SKU are visually hidden via `hidden md:inline`
 * and so don't occupy mobile grid cells. Desktop restores the full
 * 9-col layout.
 */
const GRID_CLASS =
  "grid-cols-[24px_90px_minmax(0,1fr)_24px_60px_36px_28px] md:grid-cols-[24px_110px_minmax(0,1fr)_minmax(0,2fr)_80px_24px_72px_36px_28px]";

function PaintRow({
  paint,
  rowIndex,
  active,
  inventory,
}: {
  paint: Paint;
  rowIndex: number;
  active: boolean;
  inventory: { ownedCount: number; isWishlisted: boolean } | undefined;
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
        "w-full grid items-center gap-3 px-3 text-left font-mono text-xs cursor-pointer",
        "border-b border-[var(--color-border)]",
        "hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]",
        "focus:outline-none focus-visible:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)]",
        active && "bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]",
        GRID_CLASS,
      )}
      style={{
        height: ROW_HEIGHT,
      }}
    >
      <span
        role="gridcell"
        aria-colindex={1}
        aria-hidden
        className={clsx(
          "h-5 w-5 rounded-sm border border-[var(--color-border)]",
        )}
        style={{ background: paint.hex }}
      />
      <span role="gridcell" aria-colindex={2} className="truncate text-[var(--color-fg-muted)]">{paint.brand}</span>
      <span role="gridcell" aria-colindex={3} className="hidden md:inline truncate text-[var(--color-fg-subtle)]">
        {paint.line ?? "—"}
      </span>
      <span
        role="gridcell"
        aria-colindex={4}
        className={clsx(
          "truncate",
          active ? "text-[var(--color-accent)]" : "text-[var(--color-fg)]",
        )}
      >
        {paint.name}
      </span>
      <span role="gridcell" aria-colindex={5} className="hidden md:inline truncate text-[var(--color-fg-subtle)] text-2xs">
        {paint.sku ?? ""}
      </span>
      <span role="gridcell" aria-colindex={6}>
        <TypeIcon type={paint.type} className="text-[var(--color-fg-muted)]" />
      </span>
      <span role="gridcell" aria-colindex={7} className="inline-flex items-center gap-1 uppercase text-[var(--color-fg-muted)]">
        <HexConfidenceDot confidence={paint.hexConfidence} source={paint.hexSource} />
        <span className="truncate">{paint.hex.slice(1)}</span>
      </span>
      <InventoryControls
        paintId={paint.id}
        initial={inventory}
        variant="compact"
      />
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

