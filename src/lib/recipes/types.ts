/**
 * Shared types for the Recipe editor + read paths.
 *
 * `Recipe`, `RecipeZone`, `RecipeStep`, `TechniqueKey`, and `BodyType`
 * are re-exported from the Drizzle schema so callers don't have to
 * mix UI types with raw DB types. The nested shape `RecipeWithZones`
 * is the canonical full-detail shape used by the editor page +
 * server queries.
 */

import type {
  BodyType,
  Recipe,
  RecipeStep,
  RecipeZone,
  TechniqueKey,
} from "@/db/schema";

export type { BodyType, Recipe, RecipeStep, RecipeZone, TechniqueKey };

export type RecipeZoneWithSteps = RecipeZone & {
  steps: ReadonlyArray<RecipeStep>;
};

export type RecipeWithZones = Recipe & {
  zones: ReadonlyArray<RecipeZoneWithSteps>;
};
