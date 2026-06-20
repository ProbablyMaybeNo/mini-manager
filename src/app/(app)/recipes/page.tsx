"use client";

import { Suspense, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RecipeIndexView, type RecipeStatus } from "@/components/recipe/RecipeIndexView";
import { useMockData } from "@/mock/MockProvider";
import { attachRecipeToProject } from "@/lib/actions/recipes";
import { publishRecipe } from "@/lib/actions/recipeSharing";

function RecipesRoute() {
  const data = useMockData();
  const router = useRouter();
  const preview = useSearchParams().get("state");
  const [, startTransition] = useTransition();

  const isEmpty = preview === "empty";
  const status: RecipeStatus =
    preview === "loading" ? "loading" : preview === "error" ? "error" : "ready";

  return (
    <RecipeIndexView
      recipes={isEmpty ? [] : data.recipes}
      projects={data.projects}
      status={status}
      onOpenRecipe={(r) => router.push(`/recipes/${r.id}`)}
      onNewRecipe={() => router.push("/recipes/new")}
      onAssignProject={(recipe, projectId) => {
        startTransition(async () => {
          await attachRecipeToProject({ recipeId: recipe.id, projectId });
          router.refresh();
        });
      }}
      onShare={(recipe) => {
        startTransition(async () => {
          const res = await publishRecipe({ recipeId: recipe.id });
          if (res.ok && typeof navigator !== "undefined") {
            const url = `${location.origin}/r/${res.data.slug}`;
            await navigator.clipboard?.writeText(url).catch(() => {});
          }
        });
      }}
      onRetry={() => router.refresh()}
      onEditPaint={(recipe) => {
        // MM-51 — the index view-model carries no per-slot ids to persist an
        // in-place edit, so route into the recipe editor (same shared picker,
        // full persistence) rather than silently dropping the change.
        router.push(`/recipes/${recipe.id}`);
      }}
    />
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={null}>
      <RecipesRoute />
    </Suspense>
  );
}
