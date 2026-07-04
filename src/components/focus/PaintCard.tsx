import { captionScrim, readableText } from "@/lib/color";
import type { RecipeSlot } from "@/lib/types";

/** A recipe paint shown as a card filled with its colour: brand · name · layer. */
export function PaintCard({ slot }: { slot: RecipeSlot }) {
  const fg = readableText(slot.swatch);
  // 1px halo keeps the on-swatch labels AA on mid-tone fills (UX-008).
  const scrim = captionScrim(slot.swatch);
  return (
    <div
      className="flex min-h-[120px] w-40 shrink-0 flex-col items-center justify-center gap-2 border border-cyan/40 p-3 text-center"
      style={{ backgroundColor: slot.swatch, color: fg, textShadow: scrim }}
    >
      <span className="font-body text-body uppercase tracking-[0.12em] opacity-90">
        {slot.brand}
      </span>
      <span className="font-body text-body font-medium">{slot.name}</span>
      <span className="label-osd opacity-80">
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
      className="flex min-h-[120px] w-40 shrink-0 items-center justify-center border border-cyan/40 font-button text-button uppercase tracking-[0.15em] text-cyan-lite hover:bg-cyan/10"
    >
      + Paint
    </button>
  );
}
