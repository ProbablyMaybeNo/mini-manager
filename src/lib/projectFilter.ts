import type { Priority, Project, ProjectStatus, ProjectType } from "@/lib/types";

/** Sort keys offered by the /projects management list (DOP-017). */
export type ProjectSort = "name" | "completion" | "priority" | "updated";

export interface ProjectFilters {
  /** Case-insensitive substring match against the title. Empty → no filter. */
  query: string;
  /** null → any status. */
  status: ProjectStatus | null;
  /** null → any type. */
  type: ProjectType | null;
  /** null → any priority. */
  priority: Priority | null;
  sort: ProjectSort;
}

export const DEFAULT_PROJECT_FILTERS: ProjectFilters = {
  query: "",
  status: null,
  type: null,
  priority: null,
  sort: "name",
};

/** High → Low so "High" sorts first under the priority sort. */
const PRIORITY_RANK: Record<Priority, number> = { High: 0, Med: 1, Low: 2 };

/** Does this single node match the non-structural filters (everything except
 *  the tree-keeping logic)? Query matches the title; status/type/priority are
 *  exact when set. */
function nodeMatches(p: Project, f: ProjectFilters): boolean {
  if (f.query.trim() && !p.title.toLowerCase().includes(f.query.trim().toLowerCase())) {
    return false;
  }
  if (f.status && p.status !== f.status) return false;
  if (f.type && p.type !== f.type) return false;
  if (f.priority && p.priority !== f.priority) return false;
  return true;
}

/**
 * Filter a project tree, keeping a parent whenever it OR any descendant
 * matches — so filtering by "Model" still shows the Army/Unit ancestors that
 * lead to a matching Model (the table renders the tree, expand/collapse
 * preserved). A node that matches itself keeps all of its children intact.
 */
function filterTree(items: Project[], f: ProjectFilters): Project[] {
  const out: Project[] = [];
  for (const p of items) {
    const selfMatch = nodeMatches(p, f);
    const keptChildren = p.children ? filterTree(p.children, f) : [];
    if (selfMatch) {
      // Keep the whole subtree under a self-matching node.
      out.push(p);
    } else if (keptChildren.length > 0) {
      // Keep this ancestor but pruned to the matching branch.
      out.push({ ...p, children: keptChildren });
    }
  }
  return out;
}

/** Compare top-level rows by the chosen sort key. Sub-project order inside a
 *  branch is left as-is (the tree's own structure). */
function compare(a: Project, b: Project, sort: ProjectSort): number {
  switch (sort) {
    case "name":
      return a.title.localeCompare(b.title);
    case "completion":
      // Highest completion first.
      return b.completionPercent - a.completionPercent;
    case "priority":
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    case "updated":
      // Most-recently-updated first; rows without a timestamp sink to the end.
      return (b.updatedAt ?? -Infinity) - (a.updatedAt ?? -Infinity);
  }
}

/**
 * Apply the /projects filters + sort to a project tree. Pure — returns a new
 * tree so the source stays untouched; the page passes the result straight to
 * ProjectsTable.
 */
export function applyProjectFilters(
  projects: Project[],
  filters: ProjectFilters,
): Project[] {
  const filtered = filterTree(projects, filters);
  return [...filtered].sort((a, b) => compare(a, b, filters.sort));
}

/** Are any filters narrowing the list (i.e. not the default)? Drives the
 *  "no matches" empty copy + a clear-filters affordance. */
export function hasActiveFilters(f: ProjectFilters): boolean {
  return Boolean(f.query.trim() || f.status || f.type || f.priority);
}
