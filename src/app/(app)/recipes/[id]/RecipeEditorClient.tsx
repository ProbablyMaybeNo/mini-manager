"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RecipeEditorView } from "@/components/recipe/RecipeEditorView";
import { useToast } from "@/components/kit";
import type { Paint, Project, Recipe } from "@/lib/types";
import { loadKitCatalog } from "@/lib/catalogClient";
import { saveRecipe } from "@/lib/actions/saveRecipe";
import { publishRecipe } from "@/lib/actions/recipeSharing";

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
  const { toast, node } = useToast();
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

  function share() {
    if (recipe.id === "new") {
      toast("Save the recipe before sharing.", "red");
      return;
    }
    startTransition(async () => {
      const res = await publishRecipe({ recipeId: recipe.id });
      if (!res.ok) {
        toast(res.error, "red");
        return;
      }
      const url = `${window.location.origin}/r/${res.data.slug}`;
      void navigator.clipboard?.writeText(url);
      toast("Public link copied to clipboard", "green");
    });
  }

  return (
    <>
      <RecipeEditorView
        recipe={recipe}
        projects={projects}
        paints={paints}
        onChange={setRecipe}
        onShare={share}
        onSave={persist}
        onBack={() => router.push("/recipes")}
      />
      {node}
    </>
  );
}
