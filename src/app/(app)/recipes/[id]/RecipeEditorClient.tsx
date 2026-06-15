"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RecipeEditorView } from "@/components/recipe/RecipeEditorView";
import { useToast } from "@/components/kit";
import type { Paint, Project, Recipe } from "@/lib/types";
import { loadKitCatalog } from "@/lib/catalogClient";
import { saveRecipe } from "@/lib/actions/saveRecipe";
import { publishRecipe } from "@/lib/actions/recipeSharing";
import {
  UNSAVED_CHANGES_MESSAGE,
  useUnsavedChangesGuard,
} from "@/lib/useUnsavedChangesGuard";

/** Stable signature of the editable recipe content, for dirty-checking. */
function recipeSignature(r: Recipe): string {
  return JSON.stringify({
    name: r.name,
    assignedProjectId: r.assignedProjectId ?? null,
    slots: r.slots.map((s) => ({
      paintId: s.paintId,
      swatch: s.swatch,
      layer: s.layer,
      note: s.note ?? null,
    })),
    inspo: r.inspo.map((i) => i.url),
  });
}

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
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  // An unsaved "new" draft is dirty as soon as it has a name or any slots
  // (leaving would discard it); an existing recipe is dirty once edited.
  // `saved` disarms the guard for the post-save redirect.
  const isNew = recipe.id === "new";
  const hasContent = recipe.name.trim().length > 0 || recipe.slots.length > 0;
  const dirty =
    !saved &&
    (isNew ? hasContent : recipeSignature(recipe) !== recipeSignature(initial));
  useUnsavedChangesGuard(dirty);

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
        inspo: recipe.inspo.map((r) => r.url),
      });
      if (res.ok) {
        setSaved(true); // disarm the unsaved-changes guard for the redirect
        router.push("/recipes");
      }
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
        onBack={() => {
          if (dirty && !window.confirm(UNSAVED_CHANGES_MESSAGE)) return;
          router.push("/recipes");
        }}
      />
      {node}
    </>
  );
}
