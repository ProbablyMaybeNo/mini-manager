import type { Project, NamedModel } from "@/db/schema";

/**
 * Per-unit progress percentage.
 *
 * Each model contributes 20% per stage reached. So a unit with
 * Build 10/20, Prime 5/20, Paint 3/20, Base 1/20, Complete 1/20
 * scores (10+5+3+1+1) * 20 / 20 = 20%.
 *
 * Named models within the unit each add their own contribution
 * — five booleans, 20% each.
 *
 * Returns an integer 0–100.
 */
export function progressPercent(
  project: Pick<
    Project,
    | "count"
    | "buildCount"
    | "primeCount"
    | "paintCount"
    | "baseCount"
    | "completeCount"
  >,
  namedModels: ReadonlyArray<
    Pick<
      NamedModel,
      "isBuilt" | "isPrimed" | "isPainted" | "isBased" | "isComplete"
    >
  > = [],
): number {
  const rankAndFile =
    project.buildCount +
    project.primeCount +
    project.paintCount +
    project.baseCount +
    project.completeCount;

  const named = namedModels.reduce((sum, m) => {
    return (
      sum +
      (m.isBuilt ? 1 : 0) +
      (m.isPrimed ? 1 : 0) +
      (m.isPainted ? 1 : 0) +
      (m.isBased ? 1 : 0) +
      (m.isComplete ? 1 : 0)
    );
  }, 0);

  const totalModels = project.count + namedModels.length;
  if (totalModels === 0) return 0;

  // 5 stages * 20% per stage = 100% per fully complete model
  const score = (rankAndFile + named) * 20;
  return Math.round(score / totalModels);
}

export type AggregateCounters = {
  count: number;
  ownedCount: number;
  buildCount: number;
  primeCount: number;
  paintCount: number;
  baseCount: number;
  completeCount: number;
  namedModelCount: number;
};

/**
 * Sum a project's counters with all its descendants' counters.
 * Used for Army-type parents that aggregate their child Units.
 */
export function aggregateCounters(
  root: Project,
  descendants: ReadonlyArray<Project>,
  namedModelCountByProjectId: Record<string, number> = {},
): AggregateCounters {
  const projects = [root, ...descendants];
  return projects.reduce<AggregateCounters>(
    (acc, p) => ({
      count: acc.count + p.count,
      ownedCount: acc.ownedCount + p.ownedCount,
      buildCount: acc.buildCount + p.buildCount,
      primeCount: acc.primeCount + p.primeCount,
      paintCount: acc.paintCount + p.paintCount,
      baseCount: acc.baseCount + p.baseCount,
      completeCount: acc.completeCount + p.completeCount,
      namedModelCount:
        acc.namedModelCount + (namedModelCountByProjectId[p.id] ?? 0),
    }),
    {
      count: 0,
      ownedCount: 0,
      buildCount: 0,
      primeCount: 0,
      paintCount: 0,
      baseCount: 0,
      completeCount: 0,
      namedModelCount: 0,
    },
  );
}

/**
 * A project is a "leaf" when it represents actual miniatures on the
 * desk — rank-and-file via `count > 0` or character entries via
 * `namedModelCount > 0`. Army / Warband parents at `count === 0` and
 * no named models are non-leaf containers: they aggregate from below.
 *
 * This is the inverse of "is an aggregate container". We use it on
 * the workspace page to decide whether to render the editable
 * StageCounter panel or the read-only AggregateCountersDisplay.
 */
export function isLeafProject(
  project: Pick<Project, "count">,
  namedModelCount = 0,
): boolean {
  return project.count > 0 || namedModelCount > 0;
}

/**
 * Phase-12 status set (Ross's locked answer Q3): present-tense, lead-
 * stage-derived. WISHLIST → PURCHASED → BUILDING → PRIMING → PAINTING
 * → BASING → COMPLETE. Plus SHELVED for mid-stage hibernation —
 * orthogonal to the workflow stages above.
 *
 * Status = the lead (most-advanced) stage with any count > 0. One
 * model entering a new stage immediately flips the pill, because
 * wargamers build sequentially per-unit (Ross's confirmed Q8
 * workflow).
 */
export type DisplayStatus =
  | "SHELVED"
  | "COMPLETE"
  | "BASING"
  | "PAINTING"
  | "PRIMING"
  | "BUILDING"
  | "PURCHASED"
  | "WISHLIST";

/**
 * Derived display status — used when we don't want to show raw counters.
 * Order matters: most-advanced state wins.
 *
 * The string set was renamed in Phase 12 (P12.6) per Ross's brief.
 * Previously: New / Pile / Assembling / Priming / Painting / Completed
 * / Shelved. The new vocabulary is present-tense + lock-stepped with
 * the wishlist status rename (Wanted -> WISHLIST, Bought ->
 * PURCHASED).
 */
export function displayStatus(
  project: Pick<
    Project,
    | "count"
    | "ownedCount"
    | "buildCount"
    | "primeCount"
    | "paintCount"
    | "baseCount"
    | "completeCount"
    | "isShelved"
  >,
): DisplayStatus {
  if (project.isShelved) return "SHELVED";
  if (project.count === 0) return "WISHLIST";
  if (project.completeCount === project.count) return "COMPLETE";
  if (project.baseCount > 0) return "BASING";
  if (project.paintCount > 0) return "PAINTING";
  if (project.primeCount > 0) return "PRIMING";
  if (project.buildCount > 0) return "BUILDING";
  if (project.ownedCount > 0) return "PURCHASED";
  return "WISHLIST";
}
