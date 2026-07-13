"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, ModalDialog } from "@/components/kit";
import { ShareCardComposer } from "@/components/recipe/ShareCardComposer";
import { getShareableRecipes } from "@/lib/actions/shareableRecipes";
import type { Recipe } from "@/lib/types";

/**
 * Gallery "Share your model" entry point. One click: lazy-loads the painter's
 * recipes (so browsing the gallery never pays for it), lets them pick one, and
 * drops straight into the existing ShareCardComposer — where they attach the
 * model photo, tweak notes, then Download the branded PNG or Submit it to the
 * gallery. No detour through /recipes.
 */
export function ShareYourModelButton({
  variant = "primary",
  label = "Share your model",
}: {
  variant?: "primary" | "secondary";
  label?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [selected, setSelected] = useState<Recipe | null>(null);

  async function openPicker() {
    setPickerOpen(true);
    if (recipes === null) {
      setLoading(true);
      try {
        setRecipes(await getShareableRecipes());
      } finally {
        setLoading(false);
      }
    }
  }

  function pick(recipe: Recipe) {
    setSelected(recipe);
    setPickerOpen(false);
  }

  return (
    <>
      <Button variant={variant} onClick={openPicker}>
        {label}
      </Button>

      <ModalDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Share your model"
      >
        <p className="mb-4 font-body text-body text-fg-dim">
          Pick a recipe to build a card from — then add your model photo and
          post it.
        </p>

        {loading ? (
          <p className="py-6 text-center font-body text-body text-fg-dim">
            Loading your recipes…
          </p>
        ) : recipes && recipes.length > 0 ? (
          <ul className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => pick(recipe)}
                  className="flex w-full items-center gap-3 border border-border px-3 py-2.5 text-left transition-colors hover:border-cyan/60 hover:bg-cyan/5 focus:outline-none focus-visible:border-cyan"
                >
                  <span className="flex shrink-0 gap-0.5">
                    {recipe.slots.slice(0, 8).map((slot, i) => (
                      <span
                        key={`${recipe.id}-${i}`}
                        className="h-5 w-3 border border-black/30"
                        style={{ backgroundColor: slot.swatch }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-body text-body text-fg">
                    {recipe.name}
                  </span>
                  <span className="shrink-0 font-button text-button uppercase tracking-[0.15em] text-cyan-lite">
                    Card →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="font-body text-body text-fg-dim">
              You don&apos;t have any recipes yet. Build one first, then come
              back to share it.
            </p>
            <Link href="/recipes" onClick={() => setPickerOpen(false)}>
              <Button variant="primary">Go to Recipes</Button>
            </Link>
          </div>
        )}
      </ModalDialog>

      {selected ? (
        <ShareCardComposer
          open={selected != null}
          onClose={() => setSelected(null)}
          recipeName={selected.name}
          slots={selected.slots}
          initialNotes={selected.notes ?? null}
          projectId={selected.assignedProjectId ?? null}
          recipeId={selected.id}
        />
      ) : null}
    </>
  );
}
