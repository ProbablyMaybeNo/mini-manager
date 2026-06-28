import type { Accent } from "@/lib/palette";
import type { Project } from "@/lib/types";

/**
 * Roster-level filter buckets (dashboard 4:4 filter-chip row). These are a
 * DERIVED view over a project's lifecycle status + completion%, NOT a stored
 * field — the table still shows the lifecycle status pill (BUILT/PAINTED/…).
 * The chips just decide which rows are visible.
 *
 *   IN PROGRESS  green   — in-flight (mid-paint)
 *   PLANNED      yellow  — not started (wishlist/owned, 0%)
 *   ON HOLD      purple  — shelved
 *   DONE         cyan    — complete / 100%
 *   NEARLY DONE  orange  — 80–99%
 *   OVERDUE      red     — past its deadline and not done
 */
export type RosterStatus =
  | "IN PROGRESS"
  | "PLANNED"
  | "ON HOLD"
  | "DONE"
  | "NEARLY DONE"
  | "OVERDUE";

export const ROSTER_STATUS_ACCENT: Record<RosterStatus, Accent> = {
  "IN PROGRESS": "green",
  PLANNED: "yellow",
  "ON HOLD": "purple",
  DONE: "cyan",
  "NEARLY DONE": "orange",
  OVERDUE: "red",
};

/** Optional per-project deadline lookup (ISO yyyy-mm-dd), keyed by project id.
 *  Projects don't carry a deadline field today, so OVERDUE only resolves when a
 *  caller supplies this map; absent it, OVERDUE matches nothing. */
export type DeadlineMap = Record<string, string | undefined>;

/**
 * Bucket a project into a single roster status. NEARLY-DONE wins over
 * IN-PROGRESS in the 80–99% band; DONE/OVERDUE are checked first.
 */
export function rosterStatusOf(
  project: Project,
  deadlines?: DeadlineMap,
  todayIso: string = new Date().toISOString().slice(0, 10),
): RosterStatus {
  const pct = project.completionPercent;
  const done = pct >= 100 || project.status === "COMPLETE";
  if (done) return "DONE";

  const due = deadlines?.[project.id];
  if (due && due < todayIso) return "OVERDUE";

  if (project.status === "SHELVED") return "ON HOLD";
  if (pct >= 80) return "NEARLY DONE";

  const notStarted = pct === 0 && (project.status === "WISHLIST" || project.status === "OWNED");
  if (notStarted) return "PLANNED";

  return "IN PROGRESS";
}

const PRIORITY_RANK: Record<string, number> = { High: 3, Med: 2, Low: 1 };

/** Sort a roster (top-level rows only; sub-projects keep their tree order).
 *  Returns a new array — does not mutate the input. */
export function sortRoster(
  projects: Project[],
  sort:
    | "completion-desc"
    | "completion-asc"
    | "priority-desc"
    | "title-asc"
    | "time-desc",
  minutesOf: (p: Project) => number = () => 0,
): Project[] {
  const out = [...projects];
  switch (sort) {
    case "completion-desc":
      return out.sort((a, b) => b.completionPercent - a.completionPercent);
    case "completion-asc":
      return out.sort((a, b) => a.completionPercent - b.completionPercent);
    case "priority-desc":
      return out.sort(
        (a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0),
      );
    case "title-asc":
      return out.sort((a, b) => a.title.localeCompare(b.title));
    case "time-desc":
      return out.sort((a, b) => minutesOf(b) - minutesOf(a));
    default:
      return out;
  }
}

/** Does a project (or any of its descendants) match the given roster status?
 *  A container shows under a filter if it OR a sub-project matches, so drilling
 *  into a filtered Army still finds the matching units. */
export function projectMatchesRoster(
  project: Project,
  status: RosterStatus,
  deadlines?: DeadlineMap,
  todayIso?: string,
): boolean {
  if (rosterStatusOf(project, deadlines, todayIso) === status) return true;
  return (project.children ?? []).some((c) =>
    projectMatchesRoster(c, status, deadlines, todayIso),
  );
}
