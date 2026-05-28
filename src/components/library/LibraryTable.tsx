"use client";

import { useRef, useState, useLayoutEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import type { Paint } from "@/lib/paints/types";
import { TypeIcon } from "./TypeIcon";
import { HexConfidenceDot } from "./HexConfidenceDot";

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
      className="grid items-center gap-3 px-3 py-1.5 border-b border-[var(--color-border-strong)] section-title m-0 bg-[var(--color-bg-elevated)]"
      style={{ gridTemplateColumns: GRID_COLS }}
      role="row"
    >
      <span aria-hidden />
      <span>Brand</span>
      <span className="hidden md:inline">Line</span>
      <span>Name</span>
      <span className="hidden md:inline">SKU</span>
      <span aria-label="Type">T</span>
      <span>Hex</span>
      <span className="text-center" aria-label="Owned">
        Own
      </span>
      <span className="text-center" aria-label="Wishlisted">
        ★
      </span>
    </div>
  );
}

const GRID_COLS =
  "24px 110px minmax(0, 1fr) minmax(0, 2fr) 80px 24px 72px 36px 28px";
const GRID_COLS_MOBILE = "24px 90px minmax(0, 1fr) 24px 60px 36px 28px";

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

  const owned = (inventory?.ownedCount ?? 0) > 0;
  const wished = inventory?.isWishlisted ?? false;

  return (
    <button
      type="button"
      onClick={openDetail}
      role="row"
      aria-rowindex={rowIndex + 1}
      aria-current={active ? "true" : undefined}
      className={clsx(
        "w-full grid items-center gap-3 px-3 text-left font-mono text-xs",
        "border-b border-[var(--color-border)]",
        "hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]",
        active && "bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)]",
      )}
      style={{
        height: ROW_HEIGHT,
        // Desktop grid by default; mobile gets simpler layout via responsive class below.
        gridTemplateColumns: GRID_COLS,
      }}
    >
      <span
        aria-hidden
        className={clsx(
          "h-5 w-5 rounded-sm border border-[var(--color-border)]",
        )}
        style={{ background: paint.hex }}
      />
      <span className="truncate text-[var(--color-fg-muted)]">{paint.brand}</span>
      <span className="hidden md:inline truncate text-[var(--color-fg-subtle)]">
        {paint.line ?? "—"}
      </span>
      <span
        className={clsx(
          "truncate",
          active ? "text-[var(--color-green)]" : "text-[var(--color-fg)]",
        )}
      >
        {paint.name}
      </span>
      <span className="hidden md:inline truncate text-[var(--color-fg-subtle)] text-2xs">
        {paint.sku ?? ""}
      </span>
      <TypeIcon type={paint.type} className="text-[var(--color-fg-muted)]" />
      <span className="inline-flex items-center gap-1 uppercase text-[var(--color-fg-muted)]">
        <HexConfidenceDot confidence={paint.hexConfidence} source={paint.hexSource} />
        <span className="truncate">{paint.hex.slice(1)}</span>
      </span>
      <span
        className={clsx(
          "inline-flex justify-center",
          owned ? "text-[var(--color-green)]" : "text-[var(--color-fg-subtle)]",
        )}
        aria-label={owned ? `Owned x${inventory?.ownedCount}` : "Not owned"}
      >
        {owned ? "✓" : "✗"}
      </span>
      <span
        className={clsx(
          "inline-flex justify-center",
          wished ? "text-[var(--color-amber)]" : "text-[var(--color-fg-subtle)]",
        )}
        aria-label={wished ? "Wishlisted" : "Not wishlisted"}
      >
        {wished ? "★" : "☆"}
      </span>
    </button>
  );
}

function TableFooter({ total }: { total: number }) {
  return (
    <div className="px-3 py-1.5 border-t border-[var(--color-border)] text-2xs font-mono text-[var(--color-fg-muted)] bg-[var(--color-bg-elevated)]">
      {total.toLocaleString()} paint{total === 1 ? "" : "s"}
    </div>
  );
}

// Silence "GRID_COLS_MOBILE unused" — kept as a documentation hook for the
// upcoming responsive pass.
void GRID_COLS_MOBILE;
