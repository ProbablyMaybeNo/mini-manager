"use client";

import { CloseButton, RecipePaintTile } from "@/components/kit";
import { cn } from "@/lib/cn";
import type { RecipeSlot } from "@/lib/types";

/** One editor slot: swatch + brand/name + layer + note, with reorder / pick / remove. */
export function SlotRow({
  slot,
  index,
  isFirst,
  isLast,
  onPick,
  onRemove,
  onMove,
  onLayerChange,
  onNoteChange,
}: {
  slot: RecipeSlot;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onPick: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onLayerChange: (layer: string) => void;
  onNoteChange: (note: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 border border-cyan/30 bg-bg/40 p-3">
      <div className="flex flex-col items-center gap-1 pt-1">
        <ReorderBtn label="Move up" disabled={isFirst} onClick={() => onMove(-1)}>
          ▲
        </ReorderBtn>
        <span className="font-num2 text-num2 text-fg">{index + 1}</span>
        <ReorderBtn label="Move down" disabled={isLast} onClick={() => onMove(1)}>
          ▼
        </ReorderBtn>
      </div>

      {/* l9-Ep / C1Dj / -zP2IB — large legible tile: company top, paint name
          centre, layer bottom in black/white. Clicking opens the picker. */}
      <RecipePaintTile
        hex={slot.swatch}
        name={slot.name}
        brand={slot.brand}
        layer={slot.layer}
        size="lg"
        onClick={onPick}
        ariaLabel={`Change paint for slot ${index + 1}`}
        className="mt-0.5 shrink-0"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <button type="button" onClick={onPick} className="text-left">
          <div className="font-body text-body text-fg hover:text-cyan">{slot.name}</div>
          <div className="font-body text-body uppercase tracking-[0.15em] text-fg">
            {slot.brand}
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={slot.layer}
            onChange={(e) => onLayerChange(e.target.value)}
            aria-label={`Layer for slot ${index + 1}`}
            placeholder="Layer / technique"
            className="w-36 border border-cyan/40 bg-bg px-2 py-1 font-body text-body text-fg placeholder:text-fg-faint focus:border-cyan focus:outline-none"
          />
          <input
            value={slot.note ?? ""}
            onChange={(e) => onNoteChange(e.target.value)}
            aria-label={`Note for slot ${index + 1}`}
            placeholder="Note (e.g. thin 2:1, recess only)"
            className="min-w-[160px] flex-1 border border-cyan/40 bg-bg px-2 py-1 font-body text-body text-fg placeholder:text-fg-faint focus:border-cyan focus:outline-none"
          />
        </div>
      </div>

      <CloseButton
        tone="destructive"
        onClick={onRemove}
        aria-label={`Remove slot ${index + 1}`}
      />
    </div>
  );
}

function ReorderBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // h-6 w-6 → 24px hit area (WCAG 2.2 §2.5.8) without changing the glyph
        // (UX-003); was 20px.
        "flex h-6 w-6 items-center justify-center font-button text-button leading-none",
        disabled ? "text-fg-faint/30" : "text-cyan hover:text-glow-cyan",
      )}
    >
      {children}
    </button>
  );
}
