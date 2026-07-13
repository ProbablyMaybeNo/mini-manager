"use server";

import { currentUserId } from "@/lib/auth-stub";
import { loadAppData, loadEditorRecipe } from "@/lib/appData";
import type { Recipe } from "@/lib/types";

/**
 * The current user's recipes, fully hydrated with slots + notes +
 * attached-project id — everything the ShareCardComposer needs to build a
 * card. Loaded lazily (on "Share your model" click from the gallery) so
 * browsing the gallery never pays for it. Mirrors the /recipes page's
 * summary → loadEditorRecipe hydration.
 */
export async function getShareableRecipes(): Promise<Recipe[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const data = await loadAppData(userId);
  const summaries = data.recipes ?? [];
  return Promise.all(
    summaries.map(async (r) => (await loadEditorRecipe(userId, r.id)) ?? r),
  );
}
