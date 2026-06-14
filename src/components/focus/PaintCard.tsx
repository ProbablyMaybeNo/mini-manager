import { readableText } from "@/lib/color";
import type { RecipeSlot } from "@/lib/types";

/** A recipe paint shown as a card filled with its colour: brand · name · layer. */
export function PaintCard({ slot }: { slot: RecipeSlot }) {
  const fg = readableText(slot.swatch);
  return (
    <div
      className="flex min-h-[120px] w-40 shrink-0 flex-col items-center justify-center gap-2 border border-cyan/40 p-3 text-center"
      style={{ backgroundColor: slot.swatch, color: fg }}
    >
      <span className="font-osd text-[11px] uppercase tracking-[0.12em] opacity-90">
        {slot.brand}
      </span>
      <span className="font-mono text-sm font-medium">{slot.name}</span>
      <span className="font-osd text-[10px] uppercase tracking-[0.15em] opacity-80">
        {slot.layer}
      </span>
    </div>
  );
}

/** The "+ paint" affordance at the end of the row. */
export function AddPaintCard({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[120px] w-40 shrink-0 items-center justify-center border border-cyan/40 font-osd text-sm uppercase tracking-[0.15em] text-cyan hover:bg-cyan/10"
    >
      + Paint
    </button>
  );
}
