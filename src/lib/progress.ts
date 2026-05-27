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
 * Derived display status — used when we don't want to show raw counters.
 * Order matters: most-advanced state wins.
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
): "Shelved" | "Completed" | "Painting" | "Priming" | "Assembling" | "Pile" | "Empty" {
  if (project.isShelved) return "Shelved";
  if (project.count === 0) return "Empty";
  if (project.completeCount === project.count) return "Completed";
  if (project.paintCount > 0) return "Painting";
  if (project.primeCount > 0) return "Priming";
  if (project.buildCount > 0) return "Assembling";
  if (project.ownedCount > 0) return "Pile";
  return "Empty";
}
