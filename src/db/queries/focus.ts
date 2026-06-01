import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  projects,
  recipes,
  recipeSteps,
  recipeZones,
  users,
  type Project,
  type Recipe,
  type RecipeStep,
  type RecipeZone,
} from "@/db/schema";

/**
 * P13.11 — Resolve the painter's focused project id.
 *
 * Returns null when no focus is pinned (the FOCUS section renders its
 * empty state) or when the focused project no longer exists (the FK
 * ON DELETE SET NULL nulls the column on delete, so this branch is
 * rare but the lookup still tolerates a stale value).
 */
export async function getFocusProjectId(
  userId: string,
): Promise<string | null> {
  const rows = await db
    .select({ focusProjectId: users.focusProjectId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.focusProjectId ?? null;
}

/**
 * P13.11 — Lean shape of the user's projects that have an attached
 * recipe. The FocusPicker dropdown renders one option per row; the
 * painter picks which project to focus on. Sorted by name so the
 * dropdown is scan-able.
 *
 * One query joins projects to recipes on attached_project_id; we use
 * a DISTINCT-by-projectId in memory rather than SQL since the row
 * volume is small and the helper stays portable across libsql + the
 * vitest in-memory test fixture.
 */
export interface FocusCandidate {
  id: string;
  name: string;
  type: Project["type"];
  attachedRecipeId: string;
  attachedRecipeName: string;
}

export async function listFocusCandidates(
  userId: string,
): Promise<ReadonlyArray<FocusCandidate>> {
  const rows = await db
    .select({
      projectId: projects.id,
      projectName: projects.name,
      projectType: projects.type,
      recipeId: recipes.id,
      recipeName: recipes.name,
      recipeUpdatedAt: recipes.updatedAt,
    })
    .from(projects)
    .innerJoin(recipes, eq(recipes.attachedProjectId, projects.id))
    .where(and(eq(projects.ownerId, userId), eq(recipes.ownerId, userId)))
    .orderBy(asc(projects.name), desc(recipes.updatedAt));

  const seen = new Set<string>();
  const out: FocusCandidate[] = [];
  for (const r of rows) {
    if (seen.has(r.projectId)) continue;
    seen.add(r.projectId);
    out.push({
      id: r.projectId,
      name: r.projectName,
      type: r.projectType,
      attachedRecipeId: r.recipeId,
      attachedRecipeName: r.recipeName,
    });
  }
  return out;
}

/**
 * P13.11 — Full nested shape of the focused project's first attached
 * recipe — project meta + recipe + zones + steps in display order.
 *
 * Returns null when:
 *   - no focus is set, or
 *   - the focused project no longer exists (covers a brief window
 *     before the FK ON DELETE SET NULL lands), or
 *   - the focused project has no attached recipe (shouldn't happen
 *     given the FocusPicker only lists projects with recipes, but
 *     defensive).
 *
 * Bundles paintId resolution into the caller so the page can render
 * brand+name labels without an extra round-trip.
 */
export interface FocusRecipeBundle {
  project: Project;
  recipe: Recipe;
  zones: ReadonlyArray<RecipeZone & { steps: ReadonlyArray<RecipeStep> }>;
}

export async function getFocusedRecipeBundle(
  userId: string,
): Promise<FocusRecipeBundle | null> {
  const focusedId = await getFocusProjectId(userId);
  if (!focusedId) return null;

  const projectRows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, focusedId), eq(projects.ownerId, userId)))
    .limit(1);
  const project = projectRows[0];
  if (!project) return null;

  // Pick the most-recently-updated attached recipe — matches the
  // selection ProjectColorSchemeBox already does on the detail page.
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(
      and(
        eq(recipes.ownerId, userId),
        eq(recipes.attachedProjectId, project.id),
      ),
    )
    .orderBy(desc(recipes.updatedAt))
    .limit(1);
  const recipe = recipeRows[0];
  if (!recipe) return null;

  const zoneRows = await db
    .select()
    .from(recipeZones)
    .where(eq(recipeZones.recipeId, recipe.id))
    .orderBy(asc(recipeZones.position));

  if (zoneRows.length === 0) {
    return { project, recipe, zones: [] };
  }

  const zoneIds = zoneRows.map((z) => z.id);
  const stepRows = await db
    .select()
    .from(recipeSteps)
    .where(inArray(recipeSteps.zoneId, zoneIds))
    .orderBy(asc(recipeSteps.position));

  const stepsByZone = new Map<string, RecipeStep[]>();
  for (const s of stepRows) {
    const arr = stepsByZone.get(s.zoneId) ?? [];
    arr.push(s);
    stepsByZone.set(s.zoneId, arr);
  }

  return {
    project,
    recipe,
    zones: zoneRows.map((z) => ({ ...z, steps: stepsByZone.get(z.id) ?? [] })),
  };
}
