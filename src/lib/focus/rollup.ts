import type { Project } from "@/db/schema";

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
 * `done / total` across every step in the recipe, as an integer 0–100.
 * A recipe with zero steps reports 0% (nothing to complete yet) rather
 * than dividing by zero. Done-count is clamped to total so a stale
 * completion row (step deleted out from under a mark — shouldn't happen
 * given the FK cascade, but defensive) can't push the bar past 100%.
 */
export function recipeCompletionPercent(
  doneSteps: number,
  totalSteps: number,
): number {
  if (totalSteps <= 0) return 0;
  const clamped = Math.max(0, Math.min(doneSteps, totalSteps));
  return Math.round((clamped / totalSteps) * 100);
}
