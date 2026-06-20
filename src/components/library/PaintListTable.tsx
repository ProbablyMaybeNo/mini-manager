"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/cn";
import { Chip, Swatch } from "@/components/kit";
import type { Paint } from "@/lib/types";

// Column layout — flex-basis (px) + grow factor, tuned to match the original
// auto-sized <td> widths while letting Name absorb slack like before.
const COLS: { label: string; basis: number; grow: number }[] = [
  { label: "", basis: 40, grow: 0 },
  { label: "Name", basis: 160, grow: 1 },
  { label: "Brand", basis: 120, grow: 0 },
  { label: "Line", basis: 120, grow: 0 },
  { label: "Type", basis: 90, grow: 0 },
  { label: "Hex", basis: 80, grow: 0 },
  { label: "Own", basis: 56, grow: 0 },
  { label: "Wish", basis: 56, grow: 0 },
];

const ROW_HEIGHT = 37; // px-3 py-2 + text + 1px border — matches the original row box
const OVERSCAN = 12;

function cellStyle(col: (typeof COLS)[number]): React.CSSProperties {
  return { flex: `${col.grow} 0 ${col.basis}px`, minWidth: 0 };
}

export function PaintListTable({
  paints,
  onOpenPaint,
  onToggleOwned,
  onToggleWishlist,
}: {
  paints: Paint[];
  onOpenPaint: (paint: Paint) => void;
  onToggleOwned: (paint: Paint) => void;
  onToggleWishlist: (paint: Paint) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: paints.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  if (paints.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="label-osd text-fg">No paints match</p>
          <p className="font-body text-body text-fg">Adjust or clear your filters.</p>
        </div>
      </div>
    );
  }

  const rows = virtualizer.getVirtualItems();

  return (
    <div ref={scrollRef} className="h-full overflow-auto p-4">
      <div role="table" aria-label="Paints" className="min-w-[680px]">
        <div role="rowgroup" className="sticky top-0 z-10 bg-bg/95">
          <div role="row" className="flex border-b border-cyan/30">
            {COLS.map((c, i) => (
              <div
                key={i}
                role="columnheader"
                style={cellStyle(c)}
                className="px-3 py-2 text-left label-osd tracking-[0.18em] text-fg"
              >
                {c.label}
              </div>
            ))}
          </div>
        </div>
        <div
          role="rowgroup"
          style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
        >
          {rows.map((virtualRow) => {
            const p = paints[virtualRow.index];
            if (!p) return null;
            return (
              <div
                key={p.id}
                role="row"
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="flex items-center border-b border-fg/10 transition-colors hover:bg-cyan/5"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div role="cell" style={cellStyle(COLS[0]!)} className="px-3 py-2">
                  <button type="button" onClick={() => onOpenPaint(p)} aria-label={`Open ${p.name}`}>
                    <Swatch hex={p.hex} />
                  </button>
                </div>
                <div role="cell" style={cellStyle(COLS[1]!)} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onOpenPaint(p)}
                    className="truncate font-body text-body text-fg hover:text-cyan"
                  >
                    {p.name}
                  </button>
                </div>
                <div
                  role="cell"
                  style={cellStyle(COLS[2]!)}
                  className="truncate px-3 py-2 font-body text-body text-fg"
                >
                  {p.brand}
                </div>
                <div
                  role="cell"
                  style={cellStyle(COLS[3]!)}
                  className="truncate px-3 py-2 font-body text-body text-fg"
                >
                  {p.line}
                </div>
                <div role="cell" style={cellStyle(COLS[4]!)} className="px-3 py-2">
                  <Chip accent="purple">{p.type}</Chip>
                </div>
                <div
                  role="cell"
                  style={cellStyle(COLS[5]!)}
                  className="px-3 py-2 font-body text-body uppercase tabular-nums text-fg"
                >
                  {p.hex}
                </div>
                <div role="cell" style={cellStyle(COLS[6]!)} className="px-3 py-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={p.owned}
                    aria-label={`${p.owned ? "Owned" : "Not owned"}: ${p.name}`}
                    onClick={() => onToggleOwned(p)}
                    className={cn(
                      "h-4 w-4 border",
                      p.owned ? "border-green bg-green/30" : "border-fg-faint",
                    )}
                  />
                </div>
                <div role="cell" style={cellStyle(COLS[7]!)} className="px-3 py-2">
                  <button
                    type="button"
                    aria-pressed={p.wishlisted}
                    aria-label={`${p.wishlisted ? "Wishlisted" : "Add to wishlist"}: ${p.name}`}
                    onClick={() => onToggleWishlist(p)}
                    className={cn(
                      "font-osd text-sm",
                      p.wishlisted ? "text-yellow text-glow-yellow" : "text-fg-faint hover:text-yellow",
                    )}
                  >
                    ★
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
