"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { setPaintNote } from "@/lib/actions/paintNotes";
import { phase12LayerLabel, type Phase12LayerKey, type TechniqueKey } from "@/db/schema";
import { RecipeTabs, type RecipeTab } from "@/components/focus/RecipeTabs";
import { FocusQuickActions } from "@/components/focus/FocusQuickActions";
import { SlotActivator } from "@/components/focus/SlotActivator";
import { StepCompletionCheckbox } from "@/components/focus/StepCompletionCheckbox";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";
import {
  projectStatePill,
  recipeCompletionPercent,
  type ProjectStatePillSegment,
} from "@/lib/focus/rollup";

/** Map a project-stage pill segment to a colour-bar tone so the four
 *  cumulative stages read as distinct solid blocks (DESIGN_LANGUAGE §7.2
 *  "colour bars with black text"). Cascade order BUILT → COMPLETE rises
 *  from a neutral grey through cyan/yellow to the green "go" of complete. */
const PILL_TONE: Record<ProjectStatePillSegment["key"], StatusPillKind> = {
  built: "neutral",
  primed: "info",
  painted: "warning",
  complete: "ok",
};

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
      {/* Compact project panel — a labelled terminal frame carrying the
          "painting now" header, a CircularProgress completion dial, the
          per-stage colour-bar statuses, and the quick-action row. Smaller
          than the full unit page; glanceable at the bench. */}
      <header className="panel panel-ticks relative px-3 pt-4 pb-3 space-y-3">
        <span className="panel-label" aria-hidden>
          UNIT ▸ STATUS
        </span>
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

        {/* Completion dial + stage colour-bars, side by side. The dial is
            the headline figure (DESIGN_LANGUAGE §7.1); the bars are the
            stage breakdown (§7.2). */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {totalSlots > 0 ? (
            <div
              className="flex items-center gap-3"
              data-recipe-completion
            >
              <CircularProgress
                percent={completionPct}
                size={64}
                tone="ok"
                caption="DONE"
                ariaLabel="Recipe completion"
              />
              <div className="flex flex-col leading-tight">
                <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                  {completionPct}% complete
                </span>
                <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
                  {doneSlots}/{totalSlots} slots
                </span>
              </div>
            </div>
          ) : null}

          {pillSegments ? (
            <div
              className="flex flex-wrap items-center gap-1.5 min-w-0"
              data-project-pill
              aria-label="Project stage counts"
            >
              {pillSegments.map((seg) => (
                <StatusPill
                  key={seg.key}
                  status={PILL_TONE[seg.key]}
                  tone="bar"
                  title={`${seg.value} ${seg.label}`}
                >
                  {seg.value} {seg.label}
                </StatusPill>
              ))}
            </div>
          ) : null}
        </div>

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
        <p className="panel p-4 text-xs font-sans text-[var(--color-fg-muted)]">
          This recipe has no slots yet. Open the recipe to add some, then
          come back to focus on it.
        </p>
      ) : (
        <>
          {/* Slot palette — the recipe's paints as a phosphor-bordered
              swatch strip inside a labelled terminal panel. The bench
              "parts tray": glanceable colour order before the per-slot
              detail rows below. */}
          <div className="panel panel-ticks relative px-3 pt-4 pb-3">
            <span className="panel-label" aria-hidden>
              REC ▸ PALETTE
            </span>
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
                      "block w-12 h-12 md:w-14 md:h-14 rounded-none",
                      "border border-[var(--color-border-strong)]",
                      "shadow-[0_0_0_1px_var(--color-bg),0_0_6px_-2px_rgba(0,0,0,0.8)]",
                    )}
                    style={{
                      background: slot.paintHex ?? "transparent",
                      backgroundImage: slot.paintHex
                        ? undefined
                        : "repeating-linear-gradient(45deg, var(--color-border) 0 2px, transparent 2px 6px)",
                    }}
                  />
                  <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)] text-center max-w-[4.5rem] truncate">
                    {techniqueLabel(slot.technique)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bench slot rows — one near-black panel-framed row per slot, in
              recipe order, each tagged with its slot index like a bench
              station. The active slot is ringed green; the per-paint note
              disclosure stays intact inside the detail column. */}
          <ul className="space-y-2" role="list">
            {slots.map((slot, index) => {
              const isActiveSlot = slot.id === activeSlotId;
              const isNext = slot.id === nextSlotId;
              const slotTag = `SLOT ${String(index + 1).padStart(2, "0")}`;
              return (
                <li
                  key={slot.id}
                  className={clsx(
                    "grid items-start gap-3 grid-cols-[auto_auto_minmax(0,1fr)]",
                    "panel relative p-2 pl-3",
                    isActiveSlot
                      ? "border-2 border-[var(--color-green)] bg-[var(--color-bg-elevated)]"
                      : "border border-[var(--color-border-strong)] bg-[var(--color-bg)]",
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
                    className="block w-10 h-10 md:w-12 md:h-12 rounded-none border border-[var(--color-border-strong)] shrink-0"
                    style={{
                      background: slot.paintHex ?? "transparent",
                      backgroundImage: slot.paintHex
                        ? undefined
                        : "repeating-linear-gradient(45deg, var(--color-border) 0 2px, transparent 2px 6px)",
                    }}
                  />

                  <div className="min-w-0 space-y-1">
                    <span
                      aria-hidden
                      className="block font-mono text-2xs uppercase tracking-[0.18em] text-[var(--color-cyan)]"
                    >
                      {slotTag}
                    </span>
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
                    {slot.paintId ? (
                      <PaintNoteDisclosure
                        slot={slot}
                        defaultOpen={isActiveSlot || isNext}
                      />
                    ) : null}
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
 * Progressive disclosure of the per-paint note (doc §9 + §14 FOCUS).
 *
 * The note editor used to render inline for EVERY paint-backed slot — a
 * wall of textareas that buried the glanceable "Next" tag + completion
 * bar for long recipes. This collapses each note behind a native
 * `<details>` so the panel stays scannable, revealing the editor only:
 *   - automatically for the active / next slot (`defaultOpen`) — the one
 *     the painter is working on, so no extra click in the common case;
 *   - on click for any other slot.
 *
 * Native `<details>`/`<summary>` is SSR-safe (no hydration mismatch, no
 * client open-state) and keyboard-accessible for free. The summary shows
 * a "●" indicator when the paint already carries a note, so a collapsed
 * slot still signals there's content to read. The editor inside keeps the
 * existing optimistic save-on-blur + aria-live status pattern untouched.
 */
function PaintNoteDisclosure({
  slot,
  defaultOpen,
}: {
  slot: FocusSlotView;
  defaultOpen: boolean;
}) {
  const hasNote = Boolean(slot.paintNote && slot.paintNote.trim().length > 0);
  return (
    <details className="group" open={defaultOpen} data-paint-note-disclosure>
      <summary className="flex items-center gap-1 cursor-pointer select-none font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)] marker:content-['']">
        <span
          aria-hidden
          className="inline-block transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        Paint note
        {hasNote ? (
          <span
            aria-hidden
            className="text-[var(--color-green)]"
            data-paint-note-indicator
          >
            ●
          </span>
        ) : null}
        <span className="sr-only">
          {hasNote ? " (has a note)" : " (empty)"}
        </span>
      </summary>
      <div className="mt-1">
        <PaintNoteEditor slot={slot} />
      </div>
    </details>
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
