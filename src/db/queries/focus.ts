import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  projects,
  recipes,
  recipeSlots,
  users,
  type Project,
  type Recipe,
  type RecipeSlot,
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
 * P13.11 — Full flat shape of the focused project's selected attached
 * recipe — project meta + recipe + slots in display order, plus
 * (UX-907) the *full list* of attached recipes so the FocusPanel can
 * render a tab strip when 2+ are attached.
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
 *
 * `preferredRecipeId` — when the URL carries `?focusRecipe=<id>`, pass
 * it here. The selection sticks if the id is owned + attached to the
 * focused project; otherwise we fall back to the most-recently-updated
 * attached recipe (same default ProjectColorSchemeBox uses).
 */
export interface FocusRecipeBundle {
  project: Project;
  recipe: Recipe;
  slots: ReadonlyArray<RecipeSlot>;
  /** UX-907 — every attached recipe in tab order (most-recently-updated
   *  first). When length >= 2 the FocusPanel renders a tab strip; with
   *  length 1 the strip is suppressed and current behaviour is preserved. */
  allRecipes: ReadonlyArray<{ id: string; name: string }>;
}

export async function getFocusedRecipeBundle(
  userId: string,
  preferredRecipeId?: string | null,
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

  // Fetch ALL attached recipes — sorted most-recently-updated first.
  // The default selection picks the head of that list, matching prior
  // behaviour; the explicit URL preference can override.
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(
      and(
        eq(recipes.ownerId, userId),
        eq(recipes.attachedProjectId, project.id),
      ),
    )
    .orderBy(desc(recipes.updatedAt));

  if (recipeRows.length === 0) return null;

  const allRecipes = recipeRows.map((r) => ({ id: r.id, name: r.name }));
  const recipe =
    (preferredRecipeId
      ? recipeRows.find((r) => r.id === preferredRecipeId)
      : null) ?? recipeRows[0]!;

  const slots = await db
    .select()
    .from(recipeSlots)
    .where(eq(recipeSlots.recipeId, recipe.id))
    .orderBy(asc(recipeSlots.position));

  return { project, recipe, slots, allRecipes };
}
