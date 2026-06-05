"use client";

import type { Recipe } from "@/db/schema";
import { SlotList, type SlotListItem } from "@/components/recipes/SlotList";
import { RecipeNotes } from "@/components/recipes/RecipeNotes";
import { RecipeInspo, type InspoRowVm } from "@/components/recipes/RecipeInspo";

export interface PaintInventoryState {
  ownedCount: number;
  isWishlisted: boolean;
}

interface Props {
  recipe: Recipe;
  slots: ReadonlyArray<SlotListItem>;
  ownedPaintIds?: ReadonlySet<string>;
  /** paintId → inventory state, for the slot panel's WISHLIST/OWNED buttons. */
  inventoryByPaintId?: ReadonlyMap<string, PaintInventoryState>;
  /** Saved inspo links / image URLs for this recipe (item 4). */
  inspo?: ReadonlyArray<InspoRowVm>;
}

/**
 * Flat recipe editor (2026-06-04 unify + flatten).
 *
 * A recipe is one ordered list of slots — each slot = one paint + its
 * layer. There are no zones, no separate Steps box, and no SLOTS/NOTES
 * segmented control.
 *
 * Item 5 — layout balance. RECIPE SLOTS + RECIPE NOTES split the row on a
 * proportional 3:2 ratio (was 1fr / fixed-320px, which read lopsided and
 * crushed the colour slots at wide widths). Both columns now grow with
 * the page so the slots get room without shoving notes off-balance. The
 * Inspo table sits below the row, spanning the FULL container width so its
 * left/right edges line up horizontally with the slots + notes above. On
 * mobile the columns stack and Inspo follows, full-width throughout.
 */
export function RecipeEditorClient({
  recipe,
  slots,
  ownedPaintIds,
  inventoryByPaintId,
  inspo = [],
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6">
        <section className="space-y-3">
          <SlotList
            recipeId={recipe.id}
            slots={slots}
            ownedPaintIds={ownedPaintIds}
            inventoryByPaintId={inventoryByPaintId}
          />
        </section>

        <section className="space-y-3">
          <RecipeNotes recipeId={recipe.id} initialNotes={recipe.notesMd ?? ""} />
        </section>
      </div>

      <RecipeInspo recipeId={recipe.id} initialRows={inspo} />
    </div>
  );
}
