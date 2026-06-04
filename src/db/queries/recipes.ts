import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  recipes,
  recipeSlots,
  recipeSteps,
  recipeZones,
  type Recipe,
  type RecipeSlot,
  type RecipeStep,
  type RecipeZone,
} from "@/db/schema";
import type { Paint, PaintCatalog } from "@/lib/paints/types";
import type {
  RecipeWithSlots,
  RecipeWithZones,
  RecipeZoneWithSteps,
} from "@/lib/recipes/types";

/* ============================================================
   Recipe lookups
   ============================================================ */

export async function listStandaloneRecipes(
  userId: string,
): Promise<ReadonlyArray<Recipe>> {
  return db
    .select()
    .from(recipes)
    .where(
      and(eq(recipes.ownerId, userId), eq(recipes.isStandalone, true)),
    )
    .orderBy(desc(recipes.updatedAt));
}

export async function listRecipesForProject(
  userId: string,
  projectId: string,
): Promise<ReadonlyArray<Recipe>> {
  return db
    .select()
    .from(recipes)
    .where(
      and(
        eq(recipes.ownerId, userId),
        eq(recipes.attachedProjectId, projectId),
      ),
    )
    .orderBy(desc(recipes.updatedAt));
}

export async function getRecipeById(
  userId: string,
  id: string,
): Promise<Recipe | null> {
  const rows = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.ownerId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Public read path — looks up a recipe by its `publicSlug` with no owner
 * filter. This is the ONLY query that bypasses owner-scope, intentionally:
 * anyone with a slug URL can view the recipe (P5.2 public view). Returns
 * the same nested shape as `getRecipeWithZones`, or null if the slug isn't
 * minted on any recipe.
 */
export async function getRecipeBySlug(
  slug: string,
): Promise<RecipeWithZones | null> {
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.publicSlug, slug))
    .limit(1);
  const recipe = recipeRows[0];
  if (!recipe) return null;

  const zoneRows = await db
    .select()
    .from(recipeZones)
    .where(eq(recipeZones.recipeId, recipe.id))
    .orderBy(asc(recipeZones.position));

  if (zoneRows.length === 0) {
    return { ...recipe, zones: [] };
  }

  const zoneIds = zoneRows.map((z) => z.id);
  const stepRows = await db
    .select()
    .from(recipeSteps)
    .where(inArray(recipeSteps.zoneId, zoneIds))
    .orderBy(asc(recipeSteps.position));

  const stepsByZone = new Map<string, RecipeStep[]>();
  for (const s of stepRows) {
    const arr = stepsByZone.get(s.zoneId) ?? [];
    arr.push(s);
    stepsByZone.set(s.zoneId, arr);
  }

  const zones: RecipeZoneWithSteps[] = zoneRows.map((z) => ({
    ...z,
    steps: stepsByZone.get(z.id) ?? [],
  }));

  return { ...recipe, zones };
}

/**
 * Full FLAT recipe shape (2026-06-04 unify) — the recipe + its slots
 * ordered by position. Ownership-checked; returns null when the recipe is
 * missing OR owned by another user (the two cases are not distinguished).
 * The slot-era counterpart to `getRecipeWithZones`.
 */
export async function getRecipeWithSlots(
  userId: string,
  recipeId: string,
): Promise<RecipeWithSlots | null> {
  const recipe = await getRecipeById(userId, recipeId);
  if (!recipe) return null;

  const slots = await db
    .select()
    .from(recipeSlots)
    .where(eq(recipeSlots.recipeId, recipe.id))
    .orderBy(asc(recipeSlots.position));

  return { ...recipe, slots };
}

/**
 * Full nested recipe shape — zones ordered by position, steps within
 * each zone ordered by position. Ownership-checked. Returns null when
 * the recipe is missing OR owned by another user (do NOT distinguish
 * the two cases to the caller).
 */
export async function getRecipeWithZones(
  userId: string,
  recipeId: string,
): Promise<RecipeWithZones | null> {
  const recipe = await getRecipeById(userId, recipeId);
  if (!recipe) return null;

  const zoneRows = await db
    .select()
    .from(recipeZones)
    .where(eq(recipeZones.recipeId, recipe.id))
    .orderBy(asc(recipeZones.position));

  if (zoneRows.length === 0) {
    return { ...recipe, zones: [] };
  }

  const zoneIds = zoneRows.map((z) => z.id);
  const stepRows = await db
    .select()
    .from(recipeSteps)
    .where(inArray(recipeSteps.zoneId, zoneIds))
    .orderBy(asc(recipeSteps.position));

  const stepsByZone = new Map<string, RecipeStep[]>();
  for (const s of stepRows) {
    const arr = stepsByZone.get(s.zoneId) ?? [];
    arr.push(s);
    stepsByZone.set(s.zoneId, arr);
  }

  const zones: RecipeZoneWithSteps[] = zoneRows.map((z) => ({
    ...z,
    steps: stepsByZone.get(z.id) ?? [],
  }));

  return { ...recipe, zones };
}

export interface RecipesGrouped {
  standalone: ReadonlyArray<Recipe>;
  byProject: ReadonlyArray<{ projectId: string; recipes: Recipe[] }>;
}

/**
 * All recipes for the user, partitioned into the /recipes sections in
 * a single round-trip. Groups by project preserve the per-group
 * ordering (updatedAt DESC).
 *
 * P13.4 — the prior `byNamedModel` partition is gone since named
 * models were folded into Unit projects; recipes that were attached
 * to a named model are now attached to its promoted project row.
 */
export async function listAllRecipesGrouped(
  userId: string,
): Promise<RecipesGrouped> {
  const rows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.ownerId, userId))
    .orderBy(desc(recipes.updatedAt));

  const standalone: Recipe[] = [];
  const projectMap = new Map<string, Recipe[]>();
  for (const r of rows) {
    if (r.attachedProjectId) {
      const arr = projectMap.get(r.attachedProjectId) ?? [];
      arr.push(r);
      projectMap.set(r.attachedProjectId, arr);
    } else {
      standalone.push(r);
    }
  }
  return {
    standalone,
    byProject: Array.from(projectMap, ([projectId, list]) => ({
      projectId,
      recipes: list,
    })),
  };
}

/**
 * P12.5 — Flat table-shape view of every recipe owned by the user,
 * with each recipe's palette swatches + step count + attachment
 * label already resolved server-side.
 *
 * One read pass each over `recipes`, `recipe_zone`, `recipe_step` —
 * O(R+Z+S) instead of the N+1 the card-per-recipe page used to do.
 */

export interface RecipeTableRow {
  id: string;
  name: string;
  bodyType: Recipe["bodyType"];
  attachmentKind: "standalone" | "project";
  /** Optional attachment label (project name) resolved by the caller —
   *  left null here so this stays pure-data. */
  attachedProjectId: string | null;
  /** Up to 8 hexes in zone-position order — the palette strip. */
  paletteHexes: string[];
  /** Total step count across every zone. */
  stepCount: number;
  /** Total slot count (== zone count). */
  slotCount: number;
  /** ms-timestamps so the table can sort. */
  createdAt: number;
  updatedAt: number;
  publicSlug: string | null;
}

export async function listRecipesForTable(
  userId: string,
): Promise<ReadonlyArray<RecipeTableRow>> {
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.ownerId, userId))
    .orderBy(desc(recipes.updatedAt));

  if (recipeRows.length === 0) return [];

  const recipeIds = recipeRows.map((r) => r.id);
  const zoneRows = await db
    .select()
    .from(recipeZones)
    .where(inArray(recipeZones.recipeId, recipeIds))
    .orderBy(asc(recipeZones.recipeId), asc(recipeZones.position));

  const zoneIds = zoneRows.map((z) => z.id);
  const stepRows =
    zoneIds.length > 0
      ? await db
          .select()
          .from(recipeSteps)
          .where(inArray(recipeSteps.zoneId, zoneIds))
          .orderBy(asc(recipeSteps.zoneId), asc(recipeSteps.position))
      : [];

  const stepsByZoneId = new Map<string, RecipeStep[]>();
  for (const s of stepRows) {
    const arr = stepsByZoneId.get(s.zoneId) ?? [];
    arr.push(s);
    stepsByZoneId.set(s.zoneId, arr);
  }

  const zonesByRecipeId = new Map<string, RecipeZone[]>();
  for (const z of zoneRows) {
    const arr = zonesByRecipeId.get(z.recipeId) ?? [];
    arr.push(z);
    zonesByRecipeId.set(z.recipeId, arr);
  }

  const paintHex = await getPaintHexMap();

  const out: RecipeTableRow[] = [];
  for (const r of recipeRows) {
    const zones = zonesByRecipeId.get(r.id) ?? [];
    let stepCount = 0;
    const paletteHexes: string[] = [];
    for (const z of zones) {
      const steps = stepsByZoneId.get(z.id) ?? [];
      stepCount += steps.length;
      const first = steps[0];
      if (first?.customColorHex) {
        paletteHexes.push(first.customColorHex);
      } else if (first?.paintId) {
        const hex = paintHex.get(first.paintId);
        if (hex) paletteHexes.push(hex);
      }
      if (paletteHexes.length >= 8) break;
    }
    const attachmentKind: RecipeTableRow["attachmentKind"] = r.attachedProjectId
      ? "project"
      : "standalone";
    out.push({
      id: r.id,
      name: r.name,
      bodyType: r.bodyType,
      attachmentKind,
      attachedProjectId: r.attachedProjectId,
      paletteHexes,
      stepCount,
      slotCount: zones.length,
      createdAt: r.createdAt.getTime(),
      updatedAt: r.updatedAt.getTime(),
      publicSlug: r.publicSlug,
    });
  }
  return out;
}

/**
 * P12.6 — Map of projectId → palette hexes (up to 8 swatches in
 * zone-position order) summed across every recipe attached to that
 * project. Used by the new projects dashboard table for the Recipes
 * column.
 *
 * One SELECT each over recipes / zones / steps. The palette is bounded
 * at 8 hexes per project so a one-army-thirty-recipes painter still
 * gets a tidy strip.
 */
/**
 * R7-1 — Every recipe owned by the user, lean shape for the projects
 * dashboard's inline AttachRecipe modal. Includes attachedProjectId
 * so the table client can resolve human-readable "attached to X"
 * labels for the picker. createdAt order so the first one is stable.
 */
export async function listOwnedRecipesLean(
  userId: string,
): Promise<
  ReadonlyArray<{
    id: string;
    name: string;
    attachedProjectId: string | null;
  }>
> {
  return db
    .select({
      id: recipes.id,
      name: recipes.name,
      attachedProjectId: recipes.attachedProjectId,
    })
    .from(recipes)
    .where(eq(recipes.ownerId, userId))
    .orderBy(asc(recipes.createdAt));
}

/**
 * R7-1 — Map of projectId → the recipe id to navigate to when the
 * dashboard "Recipes" cell is clicked. We pick the first recipe by
 * createdAt asc (deterministic) for projects with multiple attached
 * recipes; the cell still shows the full palette strip.
 */
export async function getProjectFirstRecipeMap(
  userId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({
      id: recipes.id,
      attachedProjectId: recipes.attachedProjectId,
      createdAt: recipes.createdAt,
    })
    .from(recipes)
    .where(eq(recipes.ownerId, userId))
    .orderBy(asc(recipes.createdAt));

  const map = new Map<string, string>();
  for (const r of rows) {
    if (!r.attachedProjectId) continue;
    if (map.has(r.attachedProjectId)) continue;
    map.set(r.attachedProjectId, r.id);
  }
  return map;
}

export async function getProjectPalettesMap(
  userId: string,
): Promise<Map<string, string[]>> {
  const recipeRows = await db
    .select({
      id: recipes.id,
      attachedProjectId: recipes.attachedProjectId,
    })
    .from(recipes)
    .where(eq(recipes.ownerId, userId));

  const recipesByProject = new Map<string, string[]>();
  for (const r of recipeRows) {
    if (!r.attachedProjectId) continue;
    const arr = recipesByProject.get(r.attachedProjectId) ?? [];
    arr.push(r.id);
    recipesByProject.set(r.attachedProjectId, arr);
  }
  const allRecipeIds = recipeRows
    .filter((r) => r.attachedProjectId)
    .map((r) => r.id);

  if (allRecipeIds.length === 0) return new Map();

  const zoneRows = await db
    .select({
      id: recipeZones.id,
      recipeId: recipeZones.recipeId,
      position: recipeZones.position,
    })
    .from(recipeZones)
    .where(inArray(recipeZones.recipeId, allRecipeIds))
    .orderBy(asc(recipeZones.recipeId), asc(recipeZones.position));

  const zoneIds = zoneRows.map((z) => z.id);
  const stepRows = zoneIds.length
    ? await db
        .select({
          zoneId: recipeSteps.zoneId,
          position: recipeSteps.position,
          paintId: recipeSteps.paintId,
          customColorHex: recipeSteps.customColorHex,
        })
        .from(recipeSteps)
        .where(inArray(recipeSteps.zoneId, zoneIds))
        .orderBy(asc(recipeSteps.zoneId), asc(recipeSteps.position))
    : [];

  // First step per zone — that's the slot's representative paint.
  const firstStepByZoneId = new Map<
    string,
    { paintId: string | null; customColorHex: string | null }
  >();
  for (const s of stepRows) {
    if (firstStepByZoneId.has(s.zoneId)) continue;
    firstStepByZoneId.set(s.zoneId, {
      paintId: s.paintId,
      customColorHex: s.customColorHex,
    });
  }

  const paintHex = await getPaintHexMap();
  const out = new Map<string, string[]>();
  for (const [projectId, recipeIds] of recipesByProject) {
    const hexes: string[] = [];
    for (const rid of recipeIds) {
      const recipeZonesForR = zoneRows.filter((z) => z.recipeId === rid);
      for (const z of recipeZonesForR) {
        const first = firstStepByZoneId.get(z.id);
        if (!first) continue;
        if (first.customColorHex) {
          hexes.push(first.customColorHex);
        } else if (first.paintId) {
          const hex = paintHex.get(first.paintId);
          if (hex) hexes.push(hex);
        }
        if (hexes.length >= 8) break;
      }
      if (hexes.length >= 8) break;
    }
    if (hexes.length > 0) out.set(projectId, hexes);
  }
  return out;
}

/**
 * Map of projectId → recipes attached to it. Used by the dashboard
 * and any "show me recipes in flight" view.
 */
export async function getProjectRecipeMap(
  userId: string,
): Promise<Map<string, Recipe[]>> {
  const rows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.ownerId, userId))
    .orderBy(desc(recipes.updatedAt));

  const out = new Map<string, Recipe[]>();
  for (const r of rows) {
    if (!r.attachedProjectId) continue;
    const arr = out.get(r.attachedProjectId) ?? [];
    arr.push(r);
    out.set(r.attachedProjectId, arr);
  }
  return out;
}

/* ============================================================
   Palette derivation
   ============================================================ */

export interface PaintMeta {
  hex: string;
  label: string;
}

let paintMetaCache: Map<string, PaintMeta> | null = null;
let paintMetaCacheExportedAt = -1;

/**
 * Server-side: read the static paint catalog from disk and build a
 * `paintId -> { hex, label }` map. Cached per export timestamp so the
 * read is O(1) after the first call. Mirrors the loader pattern in
 * `app/library/page.tsx`.
 */
export async function getPaintMetaMap(): Promise<Map<string, PaintMeta>> {
  const file = resolve(process.cwd(), "public", "data", "paints.json");
  const raw = await readFile(file, "utf8");
  const catalog = JSON.parse(raw) as PaintCatalog;
  if (
    paintMetaCache &&
    paintMetaCacheExportedAt === catalog.__exported_at
  ) {
    return paintMetaCache;
  }
  const map = new Map<string, PaintMeta>();
  for (const p of catalog.paints as ReadonlyArray<Paint>) {
    map.set(p.id, { hex: p.hex, label: `${p.brand} ${p.name}` });
  }
  paintMetaCache = map;
  paintMetaCacheExportedAt = catalog.__exported_at;
  return map;
}

async function getPaintHexMap(): Promise<Map<string, string>> {
  const meta = await getPaintMetaMap();
  const out = new Map<string, string>();
  for (const [id, m] of meta) out.set(id, m.hex);
  return out;
}

/**
 * Derive the dominant swatch hex for each zone — the first step's
 * paint hex OR customColorHex. Used by the silhouette + palette strip.
 *
 * Returns a map keyed by either the zone's `silhouetteZoneId` (when
 * present) or its `id` (so custom-named zones still resolve). The
 * silhouette consumer keys by silhouette ids; palette strips just
 * walk values.
 */
export async function paletteForRecipe(
  recipe: RecipeWithZones,
): Promise<Map<string, string>> {
  const paintHex = await getPaintHexMap();
  const out = new Map<string, string>();
  for (const zone of recipe.zones) {
    const firstStep = zone.steps[0];
    if (!firstStep) continue;
    let hex: string | null = null;
    if (firstStep.customColorHex) {
      hex = firstStep.customColorHex;
    } else if (firstStep.paintId) {
      hex = paintHex.get(firstStep.paintId) ?? null;
    }
    if (!hex) continue;
    const key = zone.silhouetteZoneId ?? zone.id;
    out.set(key, hex);
  }
  return out;
}

/**
 * Compact palette strip — up to `limit` swatch hexes in zone order.
 * Skips zones with no resolved colour. Used by `RecipeCard` +
 * `ProjectRow` to render a tiny strip without loading the full recipe.
 */
export async function paletteStripForRecipe(
  userId: string,
  recipeId: string,
  limit = 8,
): Promise<ReadonlyArray<string>> {
  const recipe = await getRecipeWithZones(userId, recipeId);
  if (!recipe) return [];
  const map = await paletteForRecipe(recipe);
  return Array.from(map.values()).slice(0, limit);
}

/**
 * Bulk palette strips for many recipes in 3 SQL queries total — owner
 * check on the recipes (1 query), zones (1 query keyed by recipe), and
 * steps (1 query keyed by zone). Avoids the N+1 explosion the per-card
 * `paletteStripForRecipe` would cause when the projects list renders
 * a strip per project.
 *
 * Returns a Map<recipeId, hex[]>. Recipes not owned by the caller are
 * silently dropped so a hostile id list can't probe other users.
 */
export async function paletteStripsForRecipes(
  userId: string,
  recipeIds: ReadonlyArray<string>,
  limit = 8,
): Promise<ReadonlyMap<string, ReadonlyArray<string>>> {
  const out = new Map<string, ReadonlyArray<string>>();
  if (recipeIds.length === 0) return out;

  const ownedRows = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(
      and(
        eq(recipes.ownerId, userId),
        inArray(recipes.id, [...recipeIds]),
      ),
    );
  const ownedIds = ownedRows.map((r) => r.id);
  if (ownedIds.length === 0) return out;

  const zoneRows = await db
    .select()
    .from(recipeZones)
    .where(inArray(recipeZones.recipeId, ownedIds))
    .orderBy(asc(recipeZones.position));
  if (zoneRows.length === 0) {
    for (const id of ownedIds) out.set(id, []);
    return out;
  }

  const zoneIds = zoneRows.map((z) => z.id);
  const stepRows = await db
    .select()
    .from(recipeSteps)
    .where(inArray(recipeSteps.zoneId, zoneIds))
    .orderBy(asc(recipeSteps.position));

  const firstStepByZone = new Map<string, RecipeStep>();
  for (const s of stepRows) {
    if (!firstStepByZone.has(s.zoneId)) firstStepByZone.set(s.zoneId, s);
  }

  const paintHex = await getPaintHexMap();
  const zonesByRecipe = new Map<string, RecipeZone[]>();
  for (const z of zoneRows) {
    const arr = zonesByRecipe.get(z.recipeId) ?? [];
    arr.push(z);
    zonesByRecipe.set(z.recipeId, arr);
  }

  for (const id of ownedIds) {
    const zones = zonesByRecipe.get(id) ?? [];
    const swatches: string[] = [];
    for (const z of zones) {
      const step = firstStepByZone.get(z.id);
      if (!step) continue;
      const hex = step.customColorHex ?? (step.paintId ? paintHex.get(step.paintId) ?? null : null);
      if (hex) swatches.push(hex);
      if (swatches.length >= limit) break;
    }
    out.set(id, swatches);
  }
  return out;
}

/* ============================================================
   Aggregate counts for cards / sidebars
   ============================================================ */

export interface RecipeSummary {
  zoneCount: number;
  stepCount: number;
}

export async function summarizeRecipe(
  userId: string,
  recipeId: string,
): Promise<RecipeSummary> {
  const recipe = await getRecipeWithZones(userId, recipeId);
  if (!recipe) return { zoneCount: 0, stepCount: 0 };
  let stepCount = 0;
  for (const z of recipe.zones) stepCount += z.steps.length;
  return { zoneCount: recipe.zones.length, stepCount };
}

/* ============================================================
   Zone / step internal lookups (used by mutations)
   ============================================================ */

/**
 * Verify a zone exists and is owned via its parent recipe. Returns the
 * zone row + the parent recipeId on success.
 */
export async function getZoneWithOwnerCheck(
  userId: string,
  zoneId: string,
): Promise<{ zone: RecipeZone; recipeId: string } | null> {
  const rows = await db
    .select({ zone: recipeZones, ownerId: recipes.ownerId })
    .from(recipeZones)
    .innerJoin(recipes, eq(recipes.id, recipeZones.recipeId))
    .where(and(eq(recipeZones.id, zoneId), eq(recipes.ownerId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { zone: row.zone, recipeId: row.zone.recipeId };
}

/**
 * Verify a step exists and is owned via its zone's parent recipe.
 * Returns the step row + ids needed for revalidation on success.
 */
export async function getStepWithOwnerCheck(
  userId: string,
  stepId: string,
): Promise<{
  step: RecipeStep;
  zoneId: string;
  recipeId: string;
} | null> {
  const rows = await db
    .select({
      step: recipeSteps,
      zoneId: recipeZones.id,
      recipeId: recipeZones.recipeId,
      ownerId: recipes.ownerId,
    })
    .from(recipeSteps)
    .innerJoin(recipeZones, eq(recipeZones.id, recipeSteps.zoneId))
    .innerJoin(recipes, eq(recipes.id, recipeZones.recipeId))
    .where(and(eq(recipeSteps.id, stepId), eq(recipes.ownerId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { step: row.step, zoneId: row.zoneId, recipeId: row.recipeId };
}

/**
 * Verify a slot exists and is owned via its parent recipe (2026-06-04
 * unify). Returns the slot row + the parent recipeId on success — the
 * flat-model counterpart to getZoneWithOwnerCheck / getStepWithOwnerCheck.
 */
export async function getSlotWithOwnerCheck(
  userId: string,
  slotId: string,
): Promise<{ slot: RecipeSlot; recipeId: string } | null> {
  const rows = await db
    .select({ slot: recipeSlots, ownerId: recipes.ownerId })
    .from(recipeSlots)
    .innerJoin(recipes, eq(recipes.id, recipeSlots.recipeId))
    .where(and(eq(recipeSlots.id, slotId), eq(recipes.ownerId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { slot: row.slot, recipeId: row.slot.recipeId };
}
