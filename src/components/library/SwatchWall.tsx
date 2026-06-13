"use client";

import { cn } from "@/lib/cn";
import type { Paint } from "@/lib/types";

/** Wall of colour swatches — each tile is one paint. Owned/wishlisted get a corner marker. */
export function SwatchWall({
  paints,
  onOpenPaint,
}: {
  paints: Paint[];
  onOpenPaint: (paint: Paint) => void;
}) {
  if (paints.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="font-osd text-sm uppercase tracking-[0.18em] text-fg-dim">
          No paints match
        </p>
        <p className="font-mono text-xs text-fg-faint">
          Adjust your filters or clear them to see the full library.
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(28px, 1fr))" }}
      role="list"
      aria-label="Paint swatches"
    >
      {paints.map((p) => (
        <button
          key={p.id}
          type="button"
          role="listitem"
          onClick={() => onOpenPaint(p)}
          title={`${p.name} — ${p.brand}`}
          aria-label={`${p.name}, ${p.brand}${p.owned ? ", owned" : ""}${p.wishlisted ? ", wishlisted" : ""}`}
          className={cn(
            "relative aspect-square w-full border border-black/40 transition-transform hover:z-10 hover:scale-125 hover:border-cyan focus-visible:z-10 focus-visible:scale-125",
          )}
          style={{ backgroundColor: p.hex }}
        >
          {p.owned && <span className="absolute right-0 top-0 h-1.5 w-1.5 bg-green" />}
          {p.wishlisted && <span className="absolute left-0 top-0 h-1.5 w-1.5 bg-yellow" />}
        </button>
      ))}
    </div>
  );
}
