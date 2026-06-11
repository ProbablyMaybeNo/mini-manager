import type { Project as DbProject, ProjectType as DbProjectType } from "@/db/schema";
import { aggregateCounters, displayStatus, progressPercent } from "@/lib/progress";
import type { Hex, Priority, Project, ProjectStatus, ProjectType } from "@/lib/types";

/** DB project type → contract project type (collapse the terrain variants). */
export function toProjectType(t: DbProjectType): ProjectType {
  switch (t) {
    case "Army":
    case "Warband":
    case "Unit":
    case "Model":
      return t;
    case "Terrain Piece":
    case "Diorama":
      return "Terrain";
  }
}

/** DB priority (Urgent/High/Medium/Low, nullable) → contract priority (Low/Med/High). */
export function toPriority(p: DbProject["priority"]): Priority {
  switch (p) {
    case "Urgent":
    case "High":
      return "High";
    case "Low":
      return "Low";
    case "Medium":
    case null:
    case undefined:
      return "Med";
  }
}

/**
 * DB project (+ its descendants for container roll-ups + recipe swatches) →
 * contract Project. Status and completion are host-derived; containers roll up
 * their subtree via the existing `aggregateCounters` helper.
 */
export function toProject(
  project: DbProject,
  opts: {
    descendants?: ReadonlyArray<DbProject>;
    swatches?: Hex[];
    children?: Project[];
  } = {},
): Project {
  const { descendants = [], swatches = [], children } = opts;
  const counters = descendants.length > 0 ? aggregateCounters(project, descendants) : project;
  const status: ProjectStatus = displayStatus({ ...counters, isShelved: project.isShelved });
  return {
    id: project.id,
    title: project.name,
    type: toProjectType(project.type),
    recipeSwatches: swatches,
    status,
    priority: toPriority(project.priority),
    completionPercent: progressPercent(counters),
    ...(children && children.length > 0 ? { children } : {}),
  };
}
