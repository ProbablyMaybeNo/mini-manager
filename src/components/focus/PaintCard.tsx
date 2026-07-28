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
      {/* The bench's recipe rows carry the brand inside `name` ("Citadel Nuln
          Oil") and leave `brand` blank, so only render the brand line when
          there's actually one — an empty span just opened a gap. */}
      {slot.brand && (
        <span className="font-body text-body uppercase tracking-[0.12em] opacity-90">
          {slot.brand}
        </span>
      )}
      <span className="font-body text-body font-medium">{slot.name}</span>
      <span className="label-osd opacity-80">
        {slot.layer}
      </span>
    </div>
  );
}

/**
 * Phone recipe tile (Ross, 2026-07-27): a small colour square with the layer
 * stamped on it and the paint name beneath. Four fit across a 375px screen, so
 * a whole recipe is visible at a glance without scrolling — the point of the
 * bench. The full 160px {@link PaintCard} is desktop-only.
 */
export function PaintTile({ slot }: { slot: RecipeSlot }) {
  const fg = readableText(slot.swatch);
  const scrim = captionScrim(slot.swatch);
  return (
    <li className="flex w-[78px] shrink-0 flex-col gap-1">
      <span
        className="flex h-[78px] w-[78px] items-end justify-center overflow-hidden border border-cyan/40 pb-1 text-center"
        style={{ backgroundColor: slot.swatch, color: fg, textShadow: scrim }}
        title={[slot.brand, slot.name].filter(Boolean).join(" ") + (slot.layer ? ` — ${slot.layer}` : "")}
      >
        {/* Explicit 8px rather than the label-osd utility — that resolves to
            --text-h2, which overshot the tile and spilled the longer techniques
            ("UNDERCOAT", "HIGHLIGHT") out past both edges. */}
        <span className="font-mono text-[8px] font-bold uppercase leading-none tracking-[0.02em] opacity-95">
          {slot.layer}
        </span>
      </span>
      <span className="line-clamp-3 font-mono text-[9px] leading-[1.2] text-fg-dim">
        {slot.name}
      </span>
    </li>
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

/** Phone-sized sibling of {@link AddPaintCard}, matching the {@link PaintTile} square. */
export function AddPaintTile({ onClick }: { onClick?: () => void }) {
  return (
    <li className="w-[78px] shrink-0">
      <button
        type="button"
        onClick={onClick}
        className="flex h-[78px] w-[78px] items-center justify-center border border-dashed border-cyan/40 font-button text-button uppercase tracking-[0.12em] text-cyan-lite hover:bg-cyan/10"
      >
        + Paint
      </button>
    </li>
  );
}
