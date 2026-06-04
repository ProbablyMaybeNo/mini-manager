/**
 * Shared types for the Recipe editor + read paths.
 *
 * `Recipe`, `RecipeSlot`, `TechniqueKey`, and `BodyType` are re-exported
 * from the Drizzle schema so callers don't have to mix UI types with raw
 * DB types. `RecipeWithSlots` is the canonical full-detail recipe shape
 * (2026-06-04 unify + flatten): a recipe is a flat ordered list of slots,
 * each = one paint (paintId | customColorHex) + its layer (`technique`).
 */

import type {
  BodyType,
  Recipe,
  RecipeSlot,
  TechniqueKey,
} from "@/db/schema";

export type { BodyType, Recipe, RecipeSlot, TechniqueKey };

export type RecipeWithSlots = Recipe & {
  slots: ReadonlyArray<RecipeSlot>;
};
