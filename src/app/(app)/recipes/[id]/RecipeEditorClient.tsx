"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RecipeEditorView } from "@/components/recipe/RecipeEditorView";
import type { Paint, Project, Recipe } from "@/lib/types";
import { loadKitCatalog } from "@/lib/catalogClient";
import { saveRecipe } from "@/lib/actions/saveRecipe";

/**
 * Recipe editor controller. The recipe (real slots) + projects come from the
 * server; the paint catalog loads client-side for the slot picker. Save
 * persists the whole edited recipe via saveRecipe, then returns to the index.
 */
export function RecipeEditorClient({
  initial,
  projects,
}: {
  initial: Recipe;
  projects: Project[];
}) {
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe>(initial);
  const [paints, setPaints] = useState<Paint[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    loadKitCatalog()
      .then((p) => {
        if (alive) setPaints(p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function persist() {
    startTransition(async () => {
      const res = await saveRecipe({
        id: recipe.id === "new" ? null : recipe.id,
        name: recipe.name,
        attachedProjectId: recipe.assignedProjectId ?? null,
        slots: recipe.slots.map((s) => ({
          paintId: s.paintId || null,
          hex: s.swatch,
          layer: s.layer,
        })),
      });
      if (res.ok) router.push("/recipes");
    });
  }

  return (
    <RecipeEditorView
      recipe={recipe}
      projects={projects}
      paints={paints}
      onChange={setRecipe}
      onShare={() => {}}
      onSave={persist}
      onBack={() => router.push("/recipes")}
    />
  );
}
