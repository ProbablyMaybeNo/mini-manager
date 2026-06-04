"use client";

import type { Recipe } from "@/db/schema";
import { SlotList, type SlotListItem } from "@/components/recipes/SlotList";
import { RecipeNotes } from "@/components/recipes/RecipeNotes";

interface Props {
  recipe: Recipe;
  slots: ReadonlyArray<SlotListItem>;
  ownedPaintIds?: ReadonlySet<string>;
}

/**
 * Flat recipe editor (2026-06-04 unify + flatten).
 *
 * A recipe is one ordered list of slots — each slot = one paint + its
 * layer. There are no zones, no separate Steps box, and no SLOTS/NOTES
 * segmented control. The slot grid is the main column; notes hang on the
 * right (and stack below on mobile).
 */
export function RecipeEditorClient({ recipe, slots, ownedPaintIds }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] gap-6">
      <section className="space-y-3">
        <SlotList
          recipeId={recipe.id}
          slots={slots}
          ownedPaintIds={ownedPaintIds}
        />
      </section>

      <section className="space-y-3">
        <RecipeNotes recipeId={recipe.id} initialNotes={recipe.notesMd ?? ""} />
      </section>
    </div>
  );
}
