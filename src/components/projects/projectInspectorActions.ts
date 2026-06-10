"use server";

import { currentUserId } from "@/lib/auth-stub";
import { getProjectById, listChildProjects } from "@/db/queries/projects";
import {
  listOwnedRecipesLean,
  listRecipesForProject,
  paletteStripsForRecipes,
} from "@/db/queries/recipes";
import { listAllProjects } from "@/db/queries/projects";
import {
  displayStatus,
  progressPercent,
  type DisplayStatus,
} from "@/lib/progress";
import type { Priority, ProjectType } from "@/db/schema";

/** Serialisable view-model for the project inspector slide-out
 *  (FIGMA-REBUILD, REBUILD_SPEC §9). Fetched client-side via the
 *  server action below so the inspector can mount from the `?project=`
 *  deep-link param on any /projects surface without the dashboard
 *  page having to thread data through. */
export interface InspectorRecipe {
  id: string;
  name: string;
  /** Palette strip swatches (slot colours, capped at 8). */
  hexes: ReadonlyArray<string>;
}

export interface InspectorChild {
  id: string;
  name: string;
  type: string;
  count: number;
  status: DisplayStatus;
  percent: number;
}

export interface InspectorAttachCandidate {
  id: string;
  name: string;
  /** Name of the project the recipe is currently attached to, if any —
   *  surfaces a "moves from X" hint before reassigning. */
  attachedToName: string | null;
}

export interface ProjectInspectorVM {
  id: string;
  name: string;
  type: ProjectType;
  faction: string | null;
  status: DisplayStatus;
  percent: number;
  priority: Priority | null;
  isShelved: boolean;
  /** Stage cascade snapshot — the completion counter validates against
   *  count ≥ … ≥ base ≥ complete client-side for friendly errors. */
  count: number;
  baseCount: number;
  completeCount: number;
  recipes: ReadonlyArray<InspectorRecipe>;
  attachCandidates: ReadonlyArray<InspectorAttachCandidate>;
  /** Direct children (units/models) — the army-list summary section.
   *  Empty for leaf projects. */
  children: ReadonlyArray<InspectorChild>;
}

/**
 * Load everything the project inspector renders, owner-scoped. Returns
 * `null` when the id doesn't exist or belongs to someone else (the
 * inspector shows its NOT-FOUND terminal state). Mined from the retired
 * /projects/[id] page (commit 5bb4c0d): getProjectById +
 * listChildProjects + listRecipesForProject + the lean owned-recipes
 * list for the ASSIGN dropdown.
 */
export async function getProjectInspectorData(
  projectId: string,
): Promise<ProjectInspectorVM | null> {
  const userId = await currentUserId();
  const project = await getProjectById(userId, projectId);
  if (!project) return null;

  const [children, attached, ownedRecipes, allProjects] = await Promise.all([
    listChildProjects(userId, project.id),
    listRecipesForProject(userId, project.id),
    listOwnedRecipesLean(userId),
    listAllProjects(userId),
  ]);

  const strips = await paletteStripsForRecipes(
    userId,
    attached.map((r) => r.id),
  );

  const projectNameById = new Map<string, string>();
  for (const p of allProjects) projectNameById.set(p.id, p.name);

  return {
    id: project.id,
    name: project.name,
    type: project.type,
    faction: project.faction,
    status: displayStatus(project),
    percent: progressPercent(project),
    priority: project.priority,
    isShelved: project.isShelved,
    count: project.count,
    baseCount: project.baseCount,
    completeCount: project.completeCount,
    recipes: attached.map((r) => ({
      id: r.id,
      name: r.name,
      hexes: strips.get(r.id) ?? [],
    })),
    attachCandidates: ownedRecipes
      .filter((r) => r.attachedProjectId !== project.id)
      .map((r) => ({
        id: r.id,
        name: r.name,
        attachedToName: r.attachedProjectId
          ? (projectNameById.get(r.attachedProjectId) ?? "(project)")
          : null,
      })),
    children: children.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      count: c.count,
      status: displayStatus(c),
      percent: progressPercent(c),
    })),
  };
}
