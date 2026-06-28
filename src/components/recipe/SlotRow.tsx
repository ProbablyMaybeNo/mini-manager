"use client";

import { IconButton, Listbox, Swatch } from "@/components/kit";
import type { Accent } from "@/lib/palette";
import { cn } from "@/lib/cn";
import type { RecipeSlot } from "@/lib/types";

/** Standard technique pills (Figma 28:4) — the recipe step taxonomy. The slot's
 *  free-text `layer` field stores the chosen technique; unrecognised values fall
 *  through as a neutral pill so legacy/custom layers still render. */
const TECHNIQUES = [
  "BASECOAT",
  "SHADE",
  "LAYER",
  "HIGHLIGHT",
  "DRYBRUSH",
  "DETAIL",
] as const;
type Technique = (typeof TECHNIQUES)[number];

const TECHNIQUE_ACCENT: Record<Technique, Accent> = {
  BASECOAT: "green",
  SHADE: "purple",
  LAYER: "cyan",
  HIGHLIGHT: "cyan",
  DRYBRUSH: "yellow",
  DETAIL: "green",
};

const pillTint: Record<Accent, string> = {
  cyan: "border-cyan/50 text-cyan",
  green: "border-green/50 text-green",
  yellow: "border-yellow/50 text-yellow",
  orange: "border-orange/50 text-orange",
  purple: "border-purple/50 text-purple",
  red: "border-red/50 text-red",
  dim: "border-border text-fg-dim",
};

function techniqueAccent(layer: string): Accent {
  const up = layer.toUpperCase() as Technique;
  return TECHNIQUES.includes(up) ? TECHNIQUE_ACCENT[up] : "dim";
}

/** One editor step row (28:4): drag-handle + nn + technique pill + paint
 *  dot/name/brand + note + delete, with reorder / pick. */
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
  const currentTechnique = (slot.layer.toUpperCase() as Technique);
  const known = TECHNIQUES.includes(currentTechnique);

  return (
    <div className="flex items-center gap-3 rounded-[6px] border border-border bg-bg/40 p-3">
      {/* Drag-handle column: the ⠿ glyph + keyboard reorder up/down. */}
      <div className="flex shrink-0 flex-col items-center">
        <ReorderBtn label={`Move step ${index + 1} up`} disabled={isFirst} onClick={() => onMove(-1)}>
          ▲
        </ReorderBtn>
        <span aria-hidden className="text-fg-faint">⠿</span>
        <ReorderBtn label={`Move step ${index + 1} down`} disabled={isLast} onClick={() => onMove(1)}>
          ▼
        </ReorderBtn>
      </div>

      {/* Zero-padded step number. */}
      <span className="shrink-0 font-mono text-body font-bold tabular-nums text-fg-dim">
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Technique pill — a bordered Listbox styled as the coloured pill. */}
      <div className="shrink-0">
        <Listbox<Technique>
          value={known ? currentTechnique : ""}
          options={TECHNIQUES.map((t) => ({ value: t, label: t }))}
          onChange={(t) => onLayerChange(t)}
          ariaLabel={`Technique for step ${index + 1}`}
          accent={techniqueAccent(slot.layer)}
          placeholder={slot.layer ? slot.layer.toUpperCase() : "TECHNIQUE"}
          triggerClassName={cn("min-w-[104px] rounded-[6px] border-solid", pillTint[techniqueAccent(slot.layer)])}
        />
      </div>

      {/* Paint dot + name + brand — clicking opens the Pick & Paint picker. */}
      <button
        type="button"
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        aria-label={`Change paint for step ${index + 1}`}
      >
        <Swatch hex={slot.swatch} size="md" className="shrink-0 rounded-full" />
        <span className="min-w-0">
          <span className="block truncate font-mono text-body text-fg-bright hover:text-cyan">
            {slot.name}
          </span>
          <span className="block truncate font-mono text-[11px] text-fg-dim">{slot.brand}</span>
        </span>
      </button>

      {/* Note. */}
      <input
        value={slot.note ?? ""}
        onChange={(e) => onNoteChange(e.target.value)}
        aria-label={`Note for step ${index + 1}`}
        placeholder="Note…"
        className="min-h-7 w-40 shrink-0 rounded-[6px] border border-border bg-bg px-2 py-1 font-mono text-[12px] text-fg placeholder:text-fg-faint focus:border-cyan focus:outline-none"
      />

      {/* Delete. */}
      <IconButton
        variant="outlineRed"
        size="sm"
        className="h-7 w-7 shrink-0"
        aria-label={`Remove step ${index + 1}`}
        onClick={onRemove}
      >
        ⊗
      </IconButton>
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
        "flex h-4 w-6 items-center justify-center font-button text-[8px] leading-none",
        disabled ? "text-fg-faint/30" : "text-cyan hover:text-fg-bright",
      )}
    >
      {children}
    </button>
  );
}
