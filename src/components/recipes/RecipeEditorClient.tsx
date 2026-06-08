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
 * Item 2 (Ross — "what do we do with all this empty space?") — fill the
 * page. The editor is a two-column grid that STRETCHES to equal heights
 * (`items-stretch`): the left column holds the tall RECIPE SLOTS grid; the
 * right column is a rail stacking RECIPE NOTES *and* INSPO, so the inspo
 * table climbs up alongside the slots instead of stranding a wide dead
 * zone below a half-empty page. Notes grows to fill the rail
 * (`flex-1`) so the right column reaches the same height as the slots.
 * Columns split on a proportional 3:2 ratio. On mobile everything stacks
 * full-width (slots → notes → inspo).
 */
export function RecipeEditorClient({
  recipe,
  slots,
  ownedPaintIds,
  inventoryByPaintId,
  inspo = [],
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 items-stretch">
      <section className="space-y-3 min-w-0">
        <SlotList
          recipeId={recipe.id}
          slots={slots}
          ownedPaintIds={ownedPaintIds}
          inventoryByPaintId={inventoryByPaintId}
        />
      </section>

      {/* Right rail — NOTES grows to fill, INSPO sits beneath it so the
          rail reaches the slots' height and no empty band is left over. */}
      <section className="flex flex-col gap-6 min-w-0">
        <RecipeNotes
          recipeId={recipe.id}
          initialNotes={recipe.notesMd ?? ""}
          className="flex-1"
        />
        <RecipeInspo recipeId={recipe.id} initialRows={inspo} />
      </section>
    </div>
  );
}
