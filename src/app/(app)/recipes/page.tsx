import { currentUserId } from "@/lib/auth-stub";
import { loadAppData, loadEditorRecipe, loadProjectsForPicker } from "@/lib/appData";
import type { Recipe } from "@/lib/types";
import { RecipeWorkbench } from "@/components/recipe/RecipeWorkbench";

export const dynamic = "force-dynamic";

/**
 * Recipes route (Figma 28:4) — a 3-pane column master-detail. The server loads
 * every recipe with its FULL slots (technique + paintId + note resolved, not
 * just the palette) so the editor column renders complete the moment a recipe
 * is selected, then hands the list + projects to the client workbench.
 */
export default async function RecipesPage() {
  const userId = await currentUserId();
  if (!userId) {
    return <RecipeWorkbench recipes={[]} projects={[]} />;
  }

  const [data, projects] = await Promise.all([
    loadAppData(userId),
    loadProjectsForPicker(userId),
  ]);

  // Resolve each recipe to its full editable form (slots with technique +
  // paintId). loadAppData only carries the palette, so hydrate per recipe.
  const summaries = data.recipes ?? [];
  const full = await Promise.all(
    summaries.map(async (r): Promise<Recipe> => {
      const detail = await loadEditorRecipe(userId, r.id);
      return detail ?? r;
    }),
  );

  return <RecipeWorkbench recipes={full} projects={projects} />;
}
