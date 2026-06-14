"use client";

import { cn } from "@/lib/cn";
import { Chip, Swatch } from "@/components/kit";
import type { Paint } from "@/lib/types";

const COLS = ["", "Name", "Brand", "Line", "Type", "Hex", "Own", "Wish"];

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
  if (paints.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="font-osd text-sm uppercase tracking-[0.18em] text-fg-dim">No paints match</p>
        <p className="font-mono text-xs text-fg-faint">Adjust or clear your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse">
        <thead>
          <tr className="border-b border-cyan/30">
            {COLS.map((c, i) => (
              <th
                key={i}
                scope="col"
                className="px-3 py-2 text-left font-osd text-[10px] uppercase tracking-[0.18em] text-fg-faint"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paints.map((p) => (
            <tr key={p.id} className="border-b border-fg/10 transition-colors hover:bg-cyan/5">
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onOpenPaint(p)}
                  aria-label={`Open ${p.name}`}
                >
                  <Swatch hex={p.hex} />
                </button>
              </td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onOpenPaint(p)}
                  className="font-mono text-sm text-fg hover:text-cyan"
                >
                  {p.name}
                </button>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-fg-dim">{p.brand}</td>
              <td className="px-3 py-2 font-mono text-xs text-fg-dim">{p.line}</td>
              <td className="px-3 py-2">
                <Chip accent="purple">{p.type}</Chip>
              </td>
              <td className="px-3 py-2 font-mono text-xs uppercase tabular-nums text-fg-dim">
                {p.hex}
              </td>
              <td className="px-3 py-2">
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
              </td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  aria-pressed={p.wishlisted}
                  aria-label={`${p.wishlisted ? "Wishlisted" : "Add to wishlist"}: ${p.name}`}
                  onClick={() => onToggleWishlist(p)}
                  className={cn(
                    "font-osd text-sm",
                    p.wishlisted ? "text-yellow text-glow-cyan" : "text-fg-faint hover:text-yellow",
                  )}
                >
                  ★
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
