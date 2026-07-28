"use client";

import { PenLine, Trash2 } from "lucide-react";
import { IconButton, Listbox, Swatch } from "@/components/kit";
import type { Accent } from "@/lib/palette";
import { cn } from "@/lib/cn";
import type { RecipeSlot } from "@/lib/types";

/** Standard technique pills (Figma 28:4) — the recipe step taxonomy. The slot's
 *  free-text `layer` field stores the chosen technique; unrecognised values fall
 *  through as a neutral pill so legacy/custom layers still render. */
const TECHNIQUES = [
  "UNDERCOAT",
  "BASECOAT",
  "SHADE",
  "LAYER",
  "HIGHLIGHT",
  "DRYBRUSH",
  "DETAIL",
] as const;
type Technique = (typeof TECHNIQUES)[number];

const TECHNIQUE_ACCENT: Record<Technique, Accent> = {
  UNDERCOAT: "orange",
  BASECOAT: "green",
  SHADE: "purple",
  LAYER: "cyan",
  HIGHLIGHT: "cyan",
  DRYBRUSH: "yellow",
  DETAIL: "green",
};

const pillTint: Record<Accent, string> = {
  cyan: "border-cyan/50 text-cyan-lite",
  green: "border-green/50 text-green",
  yellow: "border-yellow/50 text-yellow",
  orange: "border-orange/50 text-orange",
  purple: "border-purple/50 text-purple",
  red: "border-red/50 text-red",
  dim: "border-border text-fg-dim",
  neutral: "border-border text-fg",
  "priority-low": "border-priority-low/50 text-priority-low",
  "priority-med": "border-priority-med/50 text-priority-med",
  "priority-high": "border-priority-high/50 text-priority-high",
};

function techniqueAccent(layer: string): Accent {
  const up = layer.toUpperCase() as Technique;
  return TECHNIQUES.includes(up) ? TECHNIQUE_ACCENT[up] : "dim";
}

/** One editor step row (28:4): drag-handle + nn + technique pill + paint
 *  dot/name/brand + note + delete, with reorder / pick.
 *
 *  Two layouts. Desktop keeps the wide single-line row. Phones get a compact
 *  two-line block (Ross, 2026-07-27) — the desktop row squeezed a 104px
 *  technique pill, a paint name, a note input and a delete button into ~330px,
 *  so the paint name collapsed to one character per line and read as if it were
 *  stretching vertically. The phone layout is: a colour square, then two lines
 *  matching its height — the paint name on top, the technique + actions below. */
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

  const techniqueListbox = (size: "xs" | "sm") => (
    <Listbox<Technique>
      value={known ? currentTechnique : ""}
      options={TECHNIQUES.map((t) => ({ value: t, label: t }))}
      onChange={(t) => onLayerChange(t)}
      ariaLabel={`Technique for step ${index + 1}`}
      accent={techniqueAccent(slot.layer)}
      size={size}
      placeholder={slot.layer ? slot.layer.toUpperCase() : "TECHNIQUE"}
      triggerClassName={cn(
        size === "xs" ? "min-w-[96px]" : "min-w-[104px]",
        "rounded-[6px] border-solid",
        pillTint[techniqueAccent(slot.layer)],
      )}
    />
  );

  return (
    <>
      {/* ── Phone layout ──────────────────────────────────────────────── */}
      <div className="flex gap-2.5 rounded-[6px] border border-border bg-bg/40 p-2 md:hidden">
        {/* The colour square doubles as "change this paint". */}
        <button
          type="button"
          onClick={onPick}
          aria-label={`Change paint for step ${index + 1}`}
          className="shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
        >
          <Swatch hex={slot.swatch} className="h-[54px] w-[54px] rounded-[4px]" />
        </button>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-fg-dim">
              {String(index + 1).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={onPick}
              className="min-w-0 flex-1 truncate text-left font-mono text-[13px] text-fg-bright focus:outline-none focus-visible:underline"
            >
              {slot.name}
            </button>
          </div>

          {/* Every control carries a 44px hit area via an invisible centred
              `after:` zone (glyphs unchanged), and Delete is pushed a further
              12px clear of the reorder pair — a destructive button sat directly
              beside a repeated one, which is how you delete a step while trying
              to nudge it down (MUX-014). */}
          <div className="flex items-center gap-1">
            {techniqueListbox("xs")}
            <span className="ml-auto flex items-center gap-0.5">
              <ReorderBtn
                label={`Move step ${index + 1} up`}
                disabled={isFirst}
                onClick={() => onMove(-1)}
              >
                ▲
              </ReorderBtn>
              <ReorderBtn
                label={`Move step ${index + 1} down`}
                disabled={isLast}
                onClick={() => onMove(1)}
              >
                ▼
              </ReorderBtn>
              <button
                type="button"
                onClick={onPick}
                aria-label={`Change paint for step ${index + 1}`}
                className="relative inline-flex h-7 w-7 items-center justify-center text-fg-dim transition-colors hover:text-cyan-lite after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
              >
                <PenLine size={14} aria-hidden />
              </button>
              <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove step ${index + 1}`}
                className="relative ml-3 inline-flex h-7 w-7 items-center justify-center text-fg-faint transition-colors hover:text-red after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </span>
          </div>
        </div>
      </div>

      {/* ── Desktop layout ────────────────────────────────────────────── */}
      <div className="hidden items-center gap-3 rounded-[6px] border border-border bg-bg/40 p-3 md:flex">
      {/* Drag-handle column: keyboard reorder up/down with a ⠿ affordance
          between. Each arrow is a ≥24px tap target with vertical spacing so the
          two WCAG 2.5.8 target circles no longer intersect (UX-004). */}
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <ReorderBtn label={`Move step ${index + 1} up`} disabled={isFirst} onClick={() => onMove(-1)}>
          ▲
        </ReorderBtn>
        <span aria-hidden className="text-[10px] leading-none text-fg-faint">⠿</span>
        <ReorderBtn label={`Move step ${index + 1} down`} disabled={isLast} onClick={() => onMove(1)}>
          ▼
        </ReorderBtn>
      </div>

      {/* Zero-padded step number. */}
      <span className="shrink-0 font-mono text-body font-bold tabular-nums text-fg-dim">
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Technique pill — a bordered Listbox styled as the coloured pill. */}
      <div className="shrink-0">{techniqueListbox("sm")}</div>

      {/* Paint dot + name + brand — clicking opens the Pick & Paint picker.
          Swatch sized up (44px) and the name/brand wrap instead of truncating
          so the full paint name is always readable (UX polish pass). */}
      <button
        type="button"
        onClick={onPick}
        className="flex min-w-0 flex-[3] items-center gap-3 text-left"
        aria-label={`Change paint for step ${index + 1}`}
      >
        <Swatch hex={slot.swatch} size="lg" className="h-11 w-11 shrink-0 rounded-full" />
        <span className="min-w-0">
          <span className="block break-words font-mono text-body text-fg-bright hover:text-cyan-lite">
            {slot.name}
          </span>
          <span className="block break-words font-mono text-[11px] text-fg-dim">{slot.brand}</span>
        </span>
      </button>

      {/* Note — flexes to fill the available row width (UX-005) so technique
          notes are readable inline instead of truncating while the row has a
          large empty band to the right. min-w-0 lets it shrink on small rows. */}
      <input
        value={slot.note ?? ""}
        onChange={(e) => onNoteChange(e.target.value)}
        aria-label={`Note for step ${index + 1}`}
        placeholder="Note…"
        className="min-h-7 min-w-0 flex-[2] rounded-[6px] border border-border bg-bg px-2 py-1 font-mono text-[12px] text-fg placeholder:text-fg-muted focus:border-cyan focus:outline-none"
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
    </>
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
        // ≥24px visible box (h-6 w-7) around the small glyph, plus an invisible
        // centred 44px hit area so the real touch target clears WCAG 2.2 §2.5.8
        // without inflating the dense desktop row (UX-004 / MUX-014).
        "relative flex h-6 w-7 items-center justify-center rounded-[4px] font-button text-[8px] leading-none transition-colors",
        "after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
        disabled
          ? "text-fg-faint/30"
          : "text-cyan-lite hover:bg-cyan/10 hover:text-fg-bright",
      )}
    >
      {children}
    </button>
  );
}
