import type { Project } from "@/lib/types";

/**
 * Logged minutes for a project rolled up over itself + every sub-project
 * (A5qzb — Focus per-project time, UX-003/UX-011). `minutesById` is the
 * per-project minute map produced by appData from getProjectRollupSecondsMap.
 */
export function rollupProjectMinutes(
  project: Project,
  minutesById: Record<string, number>,
): number {
  let total = minutesById[project.id] ?? 0;
  for (const child of project.children ?? []) {
    total += rollupProjectMinutes(child, minutesById);
  }
  return total;
}
