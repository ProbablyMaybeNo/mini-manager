"use client";

import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/cn";
import type { Paint } from "@/lib/types";

// Swatch sizing must match the original auto-fill grid:
// repeat(auto-fill, minmax(28px, 1fr)) with a 4px (gap-1) gutter.
const MIN_TILE = 28;
const GAP = 4;
const OVERSCAN_ROWS = 6;

/** Wall of colour swatches — each tile is one paint. Owned/wishlisted get a corner marker. */
export function SwatchWall({
  paints,
  onOpenPaint,
  selectMode = false,
  selectedIds,
  onToggleSelect,
}: {
  paints: Paint[];
  onOpenPaint: (paint: Paint) => void;
  /** Bulk-select (batch/library-collection-sync item 4) — while true, a
   *  tile click toggles selection instead of opening the paint panel. */
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (paintId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

  // Mirror `auto-fill, minmax(28px, 1fr)`: as many MIN_TILE columns (plus their
  // gaps) as fit the content-box width, then each flexes to fill remaining space.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const inner = el.clientWidth - padX;
      const cols = Math.max(1, Math.floor((inner + GAP) / (MIN_TILE + GAP)));
      setColumns(cols);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowCount = Math.ceil(paints.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    // Square tiles: row height tracks tile width = (innerWidth - gaps) / columns,
    // but estimate is enough — measureElement refines real heights.
    estimateSize: () => MIN_TILE + GAP,
    overscan: OVERSCAN_ROWS,
  });

  if (paints.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="label-osd text-fg">
            No paints match
          </p>
          <p className="font-body text-body text-fg">
            Adjust your filters or clear them to see the full library.
          </p>
        </div>
      </div>
    );
  }

  const rows = virtualizer.getVirtualItems();

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-4">
      <div
        role="list"
        aria-label="Paint swatches"
        style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
      >
        {rows.map((virtualRow) => {
          const start = virtualRow.index * columns;
          const rowPaints = paints.slice(start, start + columns);
          return (
            <div
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: GAP,
              }}
            >
              {rowPaints.map((p) => {
                const isSelected = selectedIds?.has(p.id) ?? false;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role={selectMode ? "checkbox" : "listitem"}
                    aria-checked={selectMode ? isSelected : undefined}
                    onClick={() =>
                      selectMode ? onToggleSelect?.(p.id) : onOpenPaint(p)
                    }
                    title={`${p.name} — ${p.brand}`}
                    aria-label={
                      selectMode
                        ? `${p.name}, ${p.brand}${isSelected ? ", selected" : ""}`
                        : `${p.name}, ${p.brand}${p.owned ? ", owned" : ""}${p.wishlisted ? ", wishlisted" : ""}`
                    }
                    className={cn(
                      "relative aspect-square w-full border border-black/40 transition-transform hover:z-10 hover:scale-125 hover:border-cyan focus-visible:z-10 focus-visible:scale-125",
                      selectMode && isSelected && "ring-2 ring-cyan ring-offset-1 ring-offset-bg",
                    )}
                    style={{ backgroundColor: p.hex }}
                  >
                    {selectMode ? (
                      isSelected && (
                        <span
                          aria-hidden
                          className="absolute inset-0 flex items-center justify-center bg-black/30 font-bold text-cyan"
                        >
                          ✓
                        </span>
                      )
                    ) : (
                      <>
                        {p.owned && <span className="absolute right-0 top-0 h-1.5 w-1.5 bg-green" />}
                        {p.wishlisted && (
                          <span className="absolute left-0 top-0 h-1.5 w-1.5 bg-yellow" />
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
