import type { Project, RecipeSlot } from "@/db/schema";

/** Flat slot view-model the FOCUS bench renders — defined here (pure lib)
 *  so the rollup has no dependency on the presentational layer. */
export interface FocusSlotView {
  id: string;
  position: number;
  technique: RecipeSlot["technique"];
  paintHex: string | null;
  paintLabel: string | null;
  paintId: string | null;
  paintNote: string | null;
  done: boolean;
}

/**
 * P15.0 — FOCUS header project-state pill rollup.
 *
 * The pill renders a single-row mono-caps stage breakdown like
 *   "12 BUILT · 8 PRIMED · 3 PAINTED · 0 COMPLETE"
 * over the focused project's counters.
 *
 * The stage counters cascade (count ≥ owned ≥ build ≥ prime ≥ paint ≥
 * base ≥ complete), so `buildCount` literally means "models that have
 * reached at-least the build stage". The pill mirrors that cumulative
 * reading: BUILT = buildCount, PRIMED = primeCount, etc. We surface the
 * four stages Ross specced (BUILT · PRIMED · PAINTED · COMPLETE) so the
 * row stays tight; base + owned are intentionally omitted from the pill.
 */
export interface ProjectStatePillSegment {
  key: "built" | "primed" | "painted" | "complete";
  label: string;
  value: number;
}

export function projectStatePill(
  project: Pick<
    Project,
    "buildCount" | "primeCount" | "paintCount" | "completeCount"
  >,
): ReadonlyArray<ProjectStatePillSegment> {
  return [
    { key: "built", label: "BUILT", value: project.buildCount },
    { key: "primed", label: "PRIMED", value: project.primeCount },
    { key: "painted", label: "PAINTED", value: project.paintCount },
    { key: "complete", label: "COMPLETE", value: project.completeCount },
  ];
}

/** Render the pill as the canonical "12 BUILT · 8 PRIMED · …" string. */
export function projectStatePillText(
  project: Pick<
    Project,
    "buildCount" | "primeCount" | "paintCount" | "completeCount"
  >,
): string {
  return projectStatePill(project)
    .map((s) => `${s.value} ${s.label}`)
    .join(" · ");
}

/**
 * P15.0 — Recipe completion percentage.
 *
 * `done / total` across every slot in the recipe, as an integer 0–100.
 * A recipe with zero slots reports 0% (nothing to complete yet) rather
 * than dividing by zero. Done-count is clamped to total so a stale
 * completion row (slot deleted out from under a mark — shouldn't happen
 * given the FK cascade, but defensive) can't push the bar past 100%.
 */
export function recipeCompletionPercent(
  doneSlots: number,
  totalSlots: number,
): number {
  if (totalSlots <= 0) return 0;
  const clamped = Math.max(0, Math.min(doneSlots, totalSlots));
  return Math.round((clamped / totalSlots) * 100);
}

/** Minimal paint-catalog meta the FOCUS view model resolves per slot. */
export interface FocusPaintMeta {
  hex: string;
  label: string;
}

/**
 * P15.x — Build the FocusPanel's flat slot view model from the focused
 * recipe bundle plus the resolved side-data maps. Pure (no DB / no I/O)
 * so the dashboard's data-threading is unit-testable:
 *
 *   - paintMeta   resolves a slot's paintId → brand+name label + hex
 *   - completedSlotIds is the per-painter done-set (keyed on slot id;
 *                 slot.id == the old step.id, so completion rows carry
 *                 across the flatten)
 *   - paintNotes  resolves a slot's paintId → the paint's GLOBAL note
 *                 (per-paint, so every slot pinning the same paint gets
 *                 the same note threaded in)
 *
 * A custom-mix slot (no paintId, only a hex) carries a null paintId +
 * null paintNote — the panel suppresses the per-paint editor for it.
 */
export function buildFocusSlots(
  slots: ReadonlyArray<RecipeSlot>,
  paintMeta: ReadonlyMap<string, FocusPaintMeta>,
  completedSlotIds: ReadonlySet<string>,
  paintNotes: ReadonlyMap<string, string>,
): FocusSlotView[] {
  return slots.map((slot) => {
    const meta = slot.paintId ? paintMeta.get(slot.paintId) ?? null : null;
    const hex = slot.customColorHex ?? meta?.hex ?? null;
    const label = meta?.label ?? null;
    const paintNote = slot.paintId ? paintNotes.get(slot.paintId) ?? null : null;
    return {
      id: slot.id,
      position: slot.position,
      technique: slot.technique,
      paintHex: hex,
      paintLabel: label,
      paintId: slot.paintId,
      paintNote,
      done: completedSlotIds.has(slot.id),
    };
  });
}
