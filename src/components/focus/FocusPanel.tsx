"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { setPaintNote } from "@/lib/actions/paintNotes";
import { phase12LayerLabel, type Phase12LayerKey, type TechniqueKey } from "@/db/schema";
import { RecipeTabs, type RecipeTab } from "@/components/focus/RecipeTabs";
import { FocusQuickActions } from "@/components/focus/FocusQuickActions";
import { SlotActivator } from "@/components/focus/SlotActivator";
import { StepCompletionCheckbox } from "@/components/focus/StepCompletionCheckbox";
import {
  projectStatePill,
  recipeCompletionPercent,
} from "@/lib/focus/rollup";

/**
 * Dashboard FOCUS recipe panel (2026-06-04 unify + flatten).
 *
 * Renders the painter's currently-focused project's recipe in full at the
 * top of /projects so they can sit at the desk, read the recipe, and
 * scribble per-paint notes without navigating away.
 *
 * Flat layout:
 *   - Slot palette: one swatch box per slot, in slot order.
 *   - Slot cards: one card per slot, with the resolved paint (or
 *     custom-mix swatch) + brand+name + layer label + the per-PAINT note
 *     editor + a per-painter done checkbox.
 *
 * Notes model (Ross's 2026-06-02 locked call): the FOCUS scheme keeps
 * ONLY the per-PAINT note (`PaintNoteEditor`), keyed on the paint so the
 * value follows that paint to every slot it pins.
 */

export interface FocusSlotView {
  id: string;
  /** Position within the recipe (sort key only — not displayed). */
  position: number;
  technique: TechniqueKey;
  paintHex: string | null;
  paintLabel: string | null;
  /** The catalog paint id this slot pins, if any. Custom-mix slots (no
   *  paint, only a hex) are null and don't get a per-paint note editor. */
  paintId: string | null;
  /** The paint's GLOBAL per-paint note (keyed on the paint, not the
   *  slot). Threaded from `paint_notes`; the same value decorates every
   *  slot that pins this paint. Null when no note or no paint. */
  paintNote: string | null;
  /** Per-painter done-state for this slot. */
  done: boolean;
}

interface Props {
  projectId: string;
  projectName: string;
  recipeName: string;
  slots: ReadonlyArray<FocusSlotView>;
  /** UX-907 — Every attached recipe in tab order. When the array has
   *  2+ entries, FocusPanel renders the tab strip above the slot grid. */
  recipes?: ReadonlyArray<RecipeTab>;
  /** Active recipe id for the tab strip — typically the same id whose
   *  data populated `slots`. Required when `recipes.length >= 2`. */
  activeRecipeId?: string;
  /** The slot the painter is currently working on, read from
   *  `?focusSlot`. Highlighted with a distinct outline. Null = none
   *  pinned. Quick-actions' "Advance slot" operates on this slot. */
  activeSlotId?: string | null;
  /** Focused project's stage counters, for the header pill + the +Prime
   *  affordance gate. */
  projectCounts?: ProjectCounts;
}

/** Minimal counter shape the FOCUS header pill needs. */
export interface ProjectCounts {
  buildCount: number;
  primeCount: number;
  paintCount: number;
  completeCount: number;
}

function isPhase12Layer(key: TechniqueKey): key is Phase12LayerKey {
  return key in phase12LayerLabel;
}

function techniqueLabel(key: TechniqueKey): string {
  if (isPhase12Layer(key)) return phase12LayerLabel[key];
  return key
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export function FocusPanel({
  projectId,
  projectName,
  recipeName,
  slots,
  recipes,
  activeRecipeId,
  activeSlotId = null,
  projectCounts,
}: Props) {
  const totalSlots = slots.length;
  const doneSlots = slots.filter((s) => s.done).length;
  const completionPct = recipeCompletionPercent(doneSlots, totalSlots);
  const tabRecipes = recipes ?? [];
  const showTabs = tabRecipes.length >= 2 && activeRecipeId;

  // The first undone slot (in slot order) gets the subtle "NEXT" tag so
  // the painter's eye lands on the single slot they should pick up next.
  const nextSlotId = slots.find((s) => !s.done)?.id ?? null;

  // +Prime only makes sense when there's a built-but-not-primed model.
  const canPrime = projectCounts
    ? projectCounts.buildCount > projectCounts.primeCount
    : false;

  const pillSegments = projectCounts ? projectStatePill(projectCounts) : null;

  return (
    <div className="space-y-4" data-project-id={projectId}>
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
              Painting now
            </p>
            <h3 className="text-lg font-mono tracking-wide text-[var(--color-fg)] truncate">
              {projectName}
              <span className="text-[var(--color-fg-subtle)] font-normal">
                {" "}· {recipeName}
              </span>
            </h3>
          </div>
          <p className="font-mono text-2xs text-[var(--color-fg-subtle)] uppercase tracking-wider">
            {totalSlots} slot{totalSlots === 1 ? "" : "s"}
          </p>
        </div>

        {pillSegments ? (
          <p
            className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]"
            data-project-pill
          >
            {pillSegments.map((seg, i) => (
              <span key={seg.key}>
                {i > 0 ? (
                  <span className="text-[var(--color-fg-subtle)]"> · </span>
                ) : null}
                <span className="text-[var(--color-fg)]">{seg.value}</span>{" "}
                {seg.label}
              </span>
            ))}
          </p>
        ) : null}

        {totalSlots > 0 ? (
          <div className="space-y-1" data-recipe-completion>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                {completionPct}% complete
              </span>
              <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
                {doneSlots}/{totalSlots}
              </span>
            </div>
            <div
              className="h-1.5 w-full rounded-sm bg-[var(--color-bg-panel)] overflow-hidden"
              role="progressbar"
              aria-label="Recipe completion"
              aria-valuenow={completionPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-[var(--color-green)] transition-[width]"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        ) : null}

        <FocusQuickActions
          projectId={projectId}
          activeSlotId={activeSlotId}
          canPrime={canPrime}
        />
      </header>

      {showTabs ? (
        <RecipeTabs
          recipes={tabRecipes}
          activeId={activeRecipeId!}
          paramKey="focusRecipe"
          label="Attached recipes"
        />
      ) : null}

      {totalSlots === 0 ? (
        <p className="frame p-4 text-xs font-sans text-[var(--color-fg-muted)]">
          This recipe has no slots yet. Open the recipe to add some, then
          come back to focus on it.
        </p>
      ) : (
        <>
          <div
            role="list"
            aria-label="Recipe slot palette"
            className="flex flex-wrap items-center gap-3"
          >
            {slots.map((slot) => (
              <div
                key={slot.id}
                role="listitem"
                className="flex flex-col items-center gap-1"
              >
                <span
                  aria-label={`${slot.paintLabel ?? techniqueLabel(slot.technique)} swatch`}
                  className={clsx(
                    "block w-16 h-16 rounded-sm",
                    "border-2 border-[var(--color-border-strong)]",
                  )}
                  style={{
                    background: slot.paintHex ?? "transparent",
                    backgroundImage: slot.paintHex
                      ? undefined
                      : "repeating-linear-gradient(45deg, var(--color-border) 0 2px, transparent 2px 6px)",
                  }}
                />
                <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)] text-center max-w-[5rem] truncate">
                  {techniqueLabel(slot.technique)}
                </span>
              </div>
            ))}
          </div>

          <ul className="space-y-2" role="list">
            {slots.map((slot) => {
              const isActiveSlot = slot.id === activeSlotId;
              const isNext = slot.id === nextSlotId;
              return (
                <li
                  key={slot.id}
                  className={clsx(
                    "grid items-start gap-3 grid-cols-[auto_auto_minmax(0,1fr)]",
                    "p-2 rounded-sm",
                    isActiveSlot
                      ? "border-2 border-[var(--color-green)] bg-[var(--color-bg-elevated)]"
                      : "bg-[var(--color-bg-panel)] border border-[var(--color-border)]",
                    slot.done && "opacity-50",
                  )}
                  data-slot-id={slot.id}
                  data-active-slot={isActiveSlot ? "true" : undefined}
                  data-step-id={slot.id}
                  data-step-done={slot.done ? "true" : undefined}
                  aria-current={isActiveSlot ? "true" : undefined}
                >
                  <div className="flex items-center self-stretch shrink-0">
                    <StepCompletionCheckbox
                      stepId={slot.id}
                      done={slot.done}
                      label={`${slot.paintLabel ?? techniqueLabel(slot.technique)} done`}
                    />
                  </div>

                  <span
                    aria-hidden
                    className="block w-12 h-12 rounded-sm border-2 border-[var(--color-border-strong)] shrink-0"
                    style={{
                      background: slot.paintHex ?? "transparent",
                      backgroundImage: slot.paintHex
                        ? undefined
                        : "repeating-linear-gradient(45deg, var(--color-border) 0 2px, transparent 2px 6px)",
                    }}
                  />

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={clsx(
                          "font-mono text-xs uppercase tracking-wider truncate",
                          slot.done
                            ? "text-[var(--color-fg-muted)] line-through"
                            : "text-[var(--color-fg)]",
                        )}
                      >
                        {slot.paintLabel ??
                          (slot.paintHex ? slot.paintHex : "(unset)")}
                        {isNext ? (
                          <span
                            className="ml-2 not-italic no-underline font-mono text-2xs uppercase tracking-wider text-[var(--color-green)]"
                            data-next-tag
                          >
                            Next
                          </span>
                        ) : null}
                      </p>
                      <span className="shrink-0">
                        <SlotActivator slotId={slot.id} isActive={isActiveSlot} />
                      </span>
                    </div>
                    <p className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                      {techniqueLabel(slot.technique)}
                      {slot.paintHex ? (
                        <span className="text-[var(--color-fg-subtle)]">
                          {" "}
                          · {slot.paintHex}
                        </span>
                      ) : null}
                    </p>
                    {slot.paintId ? <PaintNoteEditor slot={slot} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * Per-PAINT note editor. The FOCUS scheme's SINGLE notes affordance per
 * paint-backed slot. The note is keyed on the paint id, so the value
 * follows the paint to every slot it pins. Save-on-blur via
 * `setPaintNote`, optimistic. Only rendered for paint-backed slots.
 */
function PaintNoteEditor({ slot }: { slot: FocusSlotView }) {
  const paintId = slot.paintId!;
  const [note, setNote] = useState<string>(slot.paintNote ?? "");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Sync local state when the server pushes a new value — either another
  // tab edited the paint, OR the painter edited the SAME paint on a
  // different slot in this panel (revalidate re-renders every occurrence).
  const remoteValueRef = useRef<string>(slot.paintNote ?? "");
  useEffect(() => {
    const remote = slot.paintNote ?? "";
    if (remote !== remoteValueRef.current) {
      remoteValueRef.current = remote;
      setNote(remote);
    }
  }, [slot.paintNote]);

  const persist = useCallback(() => {
    const trimmed = note.trim();
    const remote = remoteValueRef.current;
    if (trimmed === remote.trim()) return; // no change
    setSaved("saving");
    setErrorMsg(null);
    startTransition(async () => {
      const result = await setPaintNote(paintId, trimmed);
      if (!result.ok) {
        setSaved("error");
        setErrorMsg(result.error);
        return;
      }
      remoteValueRef.current = trimmed;
      setSaved("saved");
      window.setTimeout(() => setSaved("idle"), 1_500);
    });
  }, [note, paintId]);

  return (
    <div className="space-y-1" data-paint-note-for={paintId}>
      <label
        htmlFor={`paint-note-${slot.id}`}
        className="flex items-center gap-1 font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)]"
      >
        <span aria-hidden>◆</span>
        Paint note
        <span className="normal-case tracking-normal text-[var(--color-fg-muted)]">
          · applies to this paint everywhere
        </span>
      </label>
      <textarea
        id={`paint-note-${slot.id}`}
        value={note}
        placeholder="Note for this paint (mix, brand sub, technique)…"
        rows={1}
        onChange={(e) => setNote(e.target.value)}
        onBlur={persist}
        className={clsx(
          "w-full px-2 py-1 font-mono text-sm leading-snug",
          "bg-[var(--color-bg)] text-[var(--color-fg-muted)]",
          "border border-dashed border-[var(--color-border-strong)] rounded-sm",
          "focus:outline-2 focus:outline-[var(--color-fg-subtle)]",
          "resize-y min-h-[2rem]",
        )}
      />
      <p className="font-mono text-2xs leading-snug text-[var(--color-fg-muted)]">
        This note shows everywhere you use this paint.
      </p>
      <span
        className={clsx(
          "font-mono text-2xs uppercase tracking-wider",
          saved === "saved"
            ? "text-[var(--color-green)]"
            : saved === "saving"
              ? "text-[var(--color-fg-muted)]"
              : saved === "error"
                ? "text-[var(--color-red)]"
                : "text-transparent",
        )}
        aria-live="polite"
        role="status"
      >
        {saved === "saved"
          ? "Saved"
          : saved === "saving"
            ? "Saving…"
            : saved === "error"
              ? errorMsg ?? "Save failed"
              : "—"}
      </span>
    </div>
  );
}
