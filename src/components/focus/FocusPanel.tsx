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
 * P13.11 — Dashboard FOCUS recipe panel.
 *
 * Renders the painter's currently-focused project's recipe in full at
 * the top of /projects so they can sit at the desk, read the recipe,
 * and scribble per-step notes without navigating away.
 *
 * Layout:
 *   - Slot grid: one swatch box per zone, in zone order. Each swatch
 *     shows the zone's first-step hex.
 *   - Step cards: one card per step in zone order, with the resolved
 *     paint (or custom-mix swatch) + brand+name + technique label +
 *     the per-PAINT note editor (the single notes affordance — see below).
 *
 * Notes model (Ross's 2026-06-02 locked call): the FOCUS scheme keeps
 * ONLY the per-PAINT note (`PaintNoteEditor`), keyed on the paint so the
 * value follows that paint to every step it pins. The former per-STEP
 * "Painting notes…" textarea (`recipe_step.notes` via `updateStepNotes`)
 * was retired from this panel. The `recipe_step.notes` column + its
 * action remain in the schema — this is a UI consolidation, not a data
 * change — they're simply no longer surfaced in FOCUS.
 */

export interface FocusStepView {
  id: string;
  zoneId: string;
  /** Position within the zone (sort key only — not displayed). */
  position: number;
  technique: TechniqueKey;
  paintHex: string | null;
  paintLabel: string | null;
  /** P15.x — the catalog paint id this step pins, if any. Custom-mix
   *  steps (no paint, only a hex) are null and don't get a per-paint
   *  note editor. */
  paintId: string | null;
  /** P15.x — the paint's GLOBAL per-paint note (keyed on the paint, not
   *  the step). Threaded from `paint_notes`; the same value decorates
   *  every step that pins this paint. Null when the paint has no note or
   *  the step has no paint. */
  paintNote: string | null;
  /** P15.0 — per-painter done-state for this step. Renders a ticked
   *  checkbox + muted row in the active slot. */
  done: boolean;
}

export interface FocusZoneView {
  id: string;
  name: string;
  position: number;
  swatchHex: string | null;
  steps: ReadonlyArray<FocusStepView>;
}

interface Props {
  projectId: string;
  projectName: string;
  recipeName: string;
  zones: ReadonlyArray<FocusZoneView>;
  /** UX-907 — Every attached recipe in tab order. When the array has
   *  2+ entries, FocusPanel renders the tab strip above the slot grid
   *  so the painter can switch between recipes; with 1 (or omitted)
   *  it stays hidden and the panel reads exactly as before. */
  recipes?: ReadonlyArray<RecipeTab>;
  /** Active recipe id for the tab strip — typically the same id whose
   *  data populated `zones`. Required when `recipes.length >= 2`. */
  activeRecipeId?: string;
  /** P15.0 — the slot (zone) the painter is currently working on, read
   *  from `?focusSlot`. Rendered with a distinct outline + "▶ WORKING
   *  ON" label. Null = no slot pinned (the painter hasn't picked one).
   *  Quick-actions' "Advance slot" operates on this slot. */
  activeSlotId?: string | null;
  /** P15.0 — focused project's stage counters, for the header pill +
   *  the +Prime affordance gate. */
  projectCounts?: ProjectCounts;
}

/** P15.0 — minimal counter shape the FOCUS header pill needs. */
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
  // Legacy technique strings (drybrush / glaze / wet_blend / etc.):
  // render as a TitleCase fallback so the chip still reads cleanly.
  return key
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export function FocusPanel({
  projectId,
  projectName,
  recipeName,
  zones,
  recipes,
  activeRecipeId,
  activeSlotId = null,
  projectCounts,
}: Props) {
  const totalSteps = zones.reduce((acc, z) => acc + z.steps.length, 0);
  const doneSteps = zones.reduce(
    (acc, z) => acc + z.steps.filter((s) => s.done).length,
    0,
  );
  const completionPct = recipeCompletionPercent(doneSteps, totalSteps);
  const tabRecipes = recipes ?? [];
  const showTabs = tabRecipes.length >= 2 && activeRecipeId;

  // The first step (in zone order, then step order) that isn't done yet
  // gets the subtle "NEXT" tag — but only inside the active slot, so the
  // painter's eye lands on the single step they should pick up next.
  const nextStepId = (() => {
    if (!activeSlotId) return null;
    const slot = zones.find((z) => z.id === activeSlotId);
    if (!slot) return null;
    return slot.steps.find((s) => !s.done)?.id ?? null;
  })();

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
            {zones.length} slot{zones.length === 1 ? "" : "s"} · {totalSteps} step
            {totalSteps === 1 ? "" : "s"}
          </p>
        </div>

        {/* P15.0 — project-state pill + recipe completion %. */}
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

        {totalSteps > 0 ? (
          <div className="space-y-1" data-recipe-completion>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                {completionPct}% complete
              </span>
              <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
                {doneSteps}/{totalSteps}
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

        {/* P15.0 — inline quick-action buttons. */}
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

      {zones.length === 0 ? (
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
            {zones.map((zone) => (
              <div
                key={zone.id}
                role="listitem"
                className="flex flex-col items-center gap-1"
              >
                <span
                  aria-label={`${zone.name} swatch`}
                  className={clsx(
                    "block w-16 h-16 rounded-sm",
                    "border-2 border-[var(--color-border-strong)]",
                  )}
                  style={{
                    background: zone.swatchHex ?? "transparent",
                    backgroundImage: zone.swatchHex
                      ? undefined
                      : "repeating-linear-gradient(45deg, var(--color-border) 0 2px, transparent 2px 6px)",
                  }}
                />
                <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)] text-center max-w-[5rem] truncate">
                  {zone.name}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {zones.map((zone) => {
              const isActiveSlot = zone.id === activeSlotId;
              return (
                <section
                  key={zone.id}
                  className={clsx(
                    "p-3 space-y-2 rounded-sm",
                    isActiveSlot
                      ? "border-2 border-[var(--color-green)] bg-[var(--color-bg-elevated)]"
                      : "frame",
                  )}
                  aria-label={`Slot ${zone.name}`}
                  aria-current={isActiveSlot ? "true" : undefined}
                  data-slot-id={zone.id}
                  data-active-slot={isActiveSlot ? "true" : undefined}
                >
                  <header className="flex flex-wrap items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block w-4 h-4 rounded-sm border border-[var(--color-border-strong)]"
                      style={{ background: zone.swatchHex ?? "transparent" }}
                    />
                    <h4 className="font-mono text-sm uppercase tracking-wider text-[var(--color-fg)]">
                      {zone.name}
                    </h4>
                    <span className="font-mono text-2xs text-[var(--color-fg-subtle)]">
                      {zone.steps.length} step
                      {zone.steps.length === 1 ? "" : "s"}
                    </span>
                    <span className="ml-auto">
                      <SlotActivator slotId={zone.id} isActive={isActiveSlot} />
                    </span>
                  </header>

                  {zone.steps.length === 0 ? (
                    <p className="text-xs font-sans text-[var(--color-fg-muted)]">
                      No paints assigned to this slot yet.
                    </p>
                  ) : (
                    <ul className="space-y-2" role="list">
                      {zone.steps.map((step) => {
                        const isNext =
                          isActiveSlot && step.id === nextStepId;
                        return (
                          <li
                            key={step.id}
                            className={clsx(
                              "grid items-start gap-3",
                              isActiveSlot
                                ? "grid-cols-[auto_auto_minmax(0,1fr)]"
                                : "grid-cols-[auto_minmax(0,1fr)]",
                              "p-2 rounded-sm",
                              "bg-[var(--color-bg-panel)]",
                              "border border-[var(--color-border)]",
                              step.done && "opacity-50",
                            )}
                            data-step-id={step.id}
                            data-step-done={step.done ? "true" : undefined}
                          >
                            {isActiveSlot ? (
                              <div className="flex items-center self-stretch shrink-0">
                                <StepCompletionCheckbox
                                  stepId={step.id}
                                  done={step.done}
                                  label={`${zone.name} · step ${step.position + 1} done`}
                                />
                              </div>
                            ) : null}

                            <span
                              aria-hidden
                              className="block w-12 h-12 rounded-sm border-2 border-[var(--color-border-strong)] shrink-0"
                              style={{
                                background: step.paintHex ?? "transparent",
                                backgroundImage: step.paintHex
                                  ? undefined
                                  : "repeating-linear-gradient(45deg, var(--color-border) 0 2px, transparent 2px 6px)",
                              }}
                            />

                            <div className="min-w-0 space-y-1">
                              <p
                                className={clsx(
                                  "font-mono text-xs uppercase tracking-wider truncate",
                                  step.done
                                    ? "text-[var(--color-fg-muted)] line-through"
                                    : "text-[var(--color-fg)]",
                                )}
                              >
                                {step.paintLabel ??
                                  (step.paintHex ? step.paintHex : "(unset)")}
                                {isNext ? (
                                  <span
                                    className="ml-2 not-italic no-underline font-mono text-2xs uppercase tracking-wider text-[var(--color-green)]"
                                    data-next-tag
                                  >
                                    Next
                                  </span>
                                ) : null}
                              </p>
                              <p className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                                {techniqueLabel(step.technique)}
                                {step.paintHex ? (
                                  <span className="text-[var(--color-fg-subtle)]">
                                    {" "}
                                    · {step.paintHex}
                                  </span>
                                ) : null}
                              </p>
                              {step.paintId ? (
                                <PaintNoteEditor step={step} />
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * P15.x — Per-PAINT note editor. This is the FOCUS scheme's SINGLE notes
 * affordance per paint-backed step (Ross's 2026-06-02 call retired the
 * old per-step textarea). The note is keyed on the paint id, so the
 * value follows the paint to every step it pins. Save-on-blur via
 * `setPaintNote`, optimistic.
 *
 * The "applies to this paint everywhere" hint stays: it's no longer
 * disambiguating from a second field, but it still earns its place by
 * making the per-paint (global, not per-occurrence) scope legible so the
 * painter understands editing here updates every step that uses the paint.
 *
 * Only rendered for paint-backed steps (caller gates on `step.paintId`).
 */
function PaintNoteEditor({ step }: { step: FocusStepView }) {
  const paintId = step.paintId!;
  const [note, setNote] = useState<string>(step.paintNote ?? "");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Sync local state when the server pushes a new value — either another
  // tab edited the paint, OR the painter edited the SAME paint on a
  // different step in this panel (revalidate re-renders every occurrence).
  const remoteValueRef = useRef<string>(step.paintNote ?? "");
  useEffect(() => {
    const remote = step.paintNote ?? "";
    if (remote !== remoteValueRef.current) {
      remoteValueRef.current = remote;
      setNote(remote);
    }
  }, [step.paintNote]);

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
        htmlFor={`paint-note-${step.id}`}
        className="flex items-center gap-1 font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)]"
      >
        <span aria-hidden>◆</span>
        Paint note
        <span className="normal-case tracking-normal text-[var(--color-fg-muted)]">
          · applies to this paint everywhere
        </span>
      </label>
      <textarea
        id={`paint-note-${step.id}`}
        value={note}
        placeholder="Note for this paint (mix, brand sub, technique)…"
        rows={1}
        onChange={(e) => setNote(e.target.value)}
        onBlur={persist}
        className={clsx(
          "w-full px-2 py-1 font-mono text-2xs leading-snug",
          "bg-[var(--color-bg)] text-[var(--color-fg-muted)]",
          "border border-dashed border-[var(--color-border-strong)] rounded-sm",
          "focus:outline-2 focus:outline-[var(--color-fg-subtle)]",
          "resize-y min-h-[2rem]",
        )}
      />
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
