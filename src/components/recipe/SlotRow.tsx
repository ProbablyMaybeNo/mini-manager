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
        // Shrinkable at xs so the pill + the four 44px controls stay on ONE
        // line; a fixed min-width pushed the action group onto a third row and
        // gave the height back that the mobile pass had just reclaimed.
        size === "xs" ? "min-w-0 max-w-[104px]" : "min-w-[104px]",
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
              // break-words, matching the fix /tools/stacking and /tools/match
              // already got — the step's paint name is its identity, and it was
              // the one surface that swap skipped (MUX4-008).
              className="min-w-0 flex-1 break-words text-left font-mono text-[13px] leading-tight text-fg-bright focus:outline-none focus-visible:underline"
            >
              {slot.name}
            </button>
          </div>

          {/* REAL 44px boxes, not invisible `after:` zones. The round-1 attempt
              used centred pseudo-element hit areas; re-measurement showed 0px of
              growth in every direction, so the visual box WAS the target —
              28×24 with 2px between the most-repeated controls in the editor
              (MUX2-003). The group wraps to its own line when the row is too
              tight rather than shrinking back below 44px. */}
          {/* Wraps below 390px (MUX3-002; the 360px threshold fired 30px before the content actually fit, MUX5-003). Making the four controls genuinely
              44px grew the cluster ~90px → 152px, which pushed Remove off the
              right edge at 320 — its trash glyph entirely past the viewport and
              its centre returning null from elementFromPoint. The scroller hid
              it silently, so nothing said the control existed. Wrapping costs a
              line at narrow widths; shrinking the buttons back is not an option. */}
          <div className="flex flex-wrap items-center gap-2 min-[390px]:flex-nowrap">
            {techniqueListbox("xs")}
            <span className="ml-auto flex items-center">
              {/* ▲/▼ stack into one 44×44 column — two halves of a single
                  "reorder" control, so they read as a pair rather than as two
                  buttons crowding each other. */}
              <span className="flex flex-col md:flex-row md:items-center md:gap-0.5">
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
              </span>
              {/* ≥8px clear of the reorder pair so "nudge down" and "change
                  paint" aren't neighbours at 2px. */}
              <button
                type="button"
                onClick={onPick}
                aria-label={`Change paint for step ${index + 1}`}
                className="ml-2 inline-flex h-11 w-11 items-center justify-center rounded-[4px] text-fg-dim transition-colors hover:bg-cyan/10 hover:text-cyan-lite"
              >
                <PenLine size={14} aria-hidden />
              </button>
              {/* Destructive, so it keeps the widest separation in the row. */}
              <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove step ${index + 1}`}
                className="ml-3 inline-flex h-11 w-11 items-center justify-center rounded-[4px] text-fg-faint transition-colors hover:bg-red/10 hover:text-red"
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
        // 24px short edge, not 22 (MUX3-007): stacking two 22px halves took the
        // short edge BELOW the 24px floor and put the centres 22px apart, so it
        // failed the WCAG 2.5.8 spacing exception too — a regression on the very
        // axis the previous fix was measuring. h-6 makes the pair 44×48.
        "flex h-6 w-11 items-center justify-center rounded-[4px] font-button text-[8px] leading-none transition-colors md:w-7",
        disabled
          ? "text-fg-faint/30"
          : "text-cyan-lite hover:bg-cyan/10 hover:text-fg-bright",
      )}
    >
      {children}
    </button>
  );
}
