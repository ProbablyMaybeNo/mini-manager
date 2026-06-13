"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RecipeIndexView, type RecipeStatus } from "@/components/recipe/RecipeIndexView";
import { useMockData } from "@/mock/MockProvider";

function RecipesRoute() {
  const data = useMockData();
  const router = useRouter();
  const preview = useSearchParams().get("state");

  const isEmpty = preview === "empty";
  const status: RecipeStatus =
    preview === "loading" ? "loading" : preview === "error" ? "error" : "ready";

  return (
    <RecipeIndexView
      recipes={isEmpty ? [] : data.recipes}
      projects={data.projects}
      status={status}
      onOpenRecipe={(r) => router.push(`/recipes/${r.id}`)}
      onCreateRecipe={(name) => router.push(`/recipes/new?name=${encodeURIComponent(name)}`)}
      onAssignProject={() => {}}
      onShare={() => {}}
      onRetry={() => {}}
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
