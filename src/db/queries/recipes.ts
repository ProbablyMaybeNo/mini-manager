import "server-only";

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  recipes,
  recipeSlots,
  recipeInspo,
  phase12LayerLabel,
  type Recipe,
  type RecipeSlot,
  type RecipeInspo,
  type Phase12LayerKey,
  type TechniqueKey,
} from "@/db/schema";
import type { Paint, PaintCatalog } from "@/lib/paints/types";
import type { RecipeWithSlots } from "@/lib/recipes/types";
import { getInventoryByPaintId } from "@/db/queries/paintCoverage";
import { coverageFor, type CoverageState } from "@/lib/paints/coverage";

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
 * the flat slot shape, or null if the slug isn't minted on any recipe.
 */
export async function getRecipeBySlug(
  slug: string,
): Promise<RecipeWithSlots | null> {
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.publicSlug, slug))
    .limit(1);
  const recipe = recipeRows[0];
  if (!recipe) return null;

  const slots = await db
    .select()
    .from(recipeSlots)
    .where(eq(recipeSlots.recipeId, recipe.id))
    .orderBy(asc(recipeSlots.position));

  return { ...recipe, slots };
}

/**
 * Full FLAT recipe shape (2026-06-04 unify) — the recipe + its slots
 * ordered by position. Ownership-checked; returns null when the recipe is
 * missing OR owned by another user (the two cases are not distinguished).
 * The single canonical full-detail recipe reader.
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
 * Item 4 — the recipe's saved inspo links / image URLs, in position order.
 * Caller is responsible for the ownership check (the editor page already
 * resolves the recipe via getRecipeWithSlots before reading inspo).
 */
export async function listInspoForRecipe(
  recipeId: string,
): Promise<ReadonlyArray<RecipeInspo>> {
  return db
    .select()
    .from(recipeInspo)
    .where(eq(recipeInspo.recipeId, recipeId))
    .orderBy(asc(recipeInspo.position));
}

/**
 * All inspo rows for the owner's recipes in one round-trip, grouped by
 * recipe id and kept in position order. Used by the dashboard recipe
 * mapper so the focus bench can render + remove existing inspo by id.
 */
export async function getInspoMapForOwner(
  userId: string,
): Promise<Map<string, { id: string; url: string; imageUrl: string | null }[]>> {
  const rows = await db
    .select({
      id: recipeInspo.id,
      url: recipeInspo.url,
      imageUrl: recipeInspo.imageUrl,
      recipeId: recipeInspo.recipeId,
    })
    .from(recipeInspo)
    .innerJoin(recipes, eq(recipeInspo.recipeId, recipes.id))
    .where(eq(recipes.ownerId, userId))
    .orderBy(asc(recipeInspo.position));
  const map = new Map<string, { id: string; url: string; imageUrl: string | null }[]>();
  for (const r of rows) {
    const entry = { id: r.id, url: r.url, imageUrl: r.imageUrl };
    const list = map.get(r.recipeId);
    if (list) list.push(entry);
    else map.set(r.recipeId, [entry]);
  }
  return map;
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
 * with each recipe's palette swatches + slot count + attachment
 * label already resolved server-side.
 *
 * One read pass each over `recipes` and `recipe_slot` — O(R+S) flat.
 */

function layerLabelFor(technique: TechniqueKey): string {
  if (technique in phase12LayerLabel) {
    return phase12LayerLabel[technique as Phase12LayerKey];
  }
  return technique
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

/** One rich paint square for the /recipes table row — same data the
 *  recipe creator's slot cell renders (colour, paint name, layer) plus
 *  ownership coverage for the green/yellow border, and a flag marking
 *  a colour-only slot with no catalog paint assigned (renders the
 *  "+ Assign Paint" affordance instead of a name). */
export interface RecipeTableSlot {
  hex: string;
  /** Resolved "Brand Name" for catalog paints; null for a colour-only
   *  slot with no paint assigned. */
  paintLabel: string | null;
  /** Human layer label (Basecoat / Highlight / …). */
  layerLabel: string;
  /** Ownership coverage — "none" for colour-only slots (no paint to own). */
  coverage: CoverageState;
  /** True when the slot is just a colour with no catalog paint assigned. */
  needsPaint: boolean;
}

export interface RecipeTableRow {
  id: string;
  name: string;
  bodyType: Recipe["bodyType"];
  attachmentKind: "standalone" | "project";
  /** Optional attachment label (project name) resolved by the caller —
   *  left null here so this stays pure-data. */
  attachedProjectId: string | null;
  /** Up to 8 hexes in slot-position order — the palette strip. */
  paletteHexes: string[];
  /** Up to 8 swatches in slot-position order — each carries its colour
   *  plus a hover label: the paint's "Brand Name" for catalog slots, or
   *  the hex itself for custom-colour slots with no paint. */
  palette: { hex: string; label: string }[];
  /** Rich per-slot squares (paint name + layer + coverage), creator-sized,
   *  in slot-position order (bounded). */
  slots: RecipeTableSlot[];
  /** Total slot count (one paint + layer per slot). */
  slotCount: number;
  /** ms-timestamps so the table can sort. */
  createdAt: number;
  updatedAt: number;
  publicSlug: string | null;
}

export async function listRecipesForTable(
  userId: string,
  perRecipeSlotCap = 12,
): Promise<ReadonlyArray<RecipeTableRow>> {
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.ownerId, userId))
    .orderBy(desc(recipes.updatedAt));

  if (recipeRows.length === 0) return [];

  const recipeIds = recipeRows.map((r) => r.id);
  const slotRows = await db
    .select()
    .from(recipeSlots)
    .where(inArray(recipeSlots.recipeId, recipeIds))
    .orderBy(asc(recipeSlots.recipeId), asc(recipeSlots.position));

  const slotsByRecipeId = new Map<string, RecipeSlot[]>();
  for (const s of slotRows) {
    const arr = slotsByRecipeId.get(s.recipeId) ?? [];
    arr.push(s);
    slotsByRecipeId.set(s.recipeId, arr);
  }

  const [paintMeta, inventory] = await Promise.all([
    getPaintMetaMap(),
    getInventoryByPaintId(userId),
  ]);

  const out: RecipeTableRow[] = [];
  for (const r of recipeRows) {
    const slots = slotsByRecipeId.get(r.id) ?? [];
    const paletteHexes: string[] = [];
    const palette: { hex: string; label: string }[] = [];
    const richSlots: RecipeTableSlot[] = [];
    for (const slot of slots) {
      if (slot.paintId) {
        const meta = paintMeta.get(slot.paintId);
        if (meta) {
          if (paletteHexes.length < 8) {
            paletteHexes.push(meta.hex);
            palette.push({ hex: meta.hex, label: meta.label });
          }
          if (richSlots.length < perRecipeSlotCap) {
            richSlots.push({
              hex: meta.hex,
              paintLabel: meta.label,
              layerLabel: layerLabelFor(slot.technique),
              coverage: coverageFor(slot.paintId, inventory),
              needsPaint: false,
            });
          }
        }
      } else if (slot.customColorHex) {
        if (paletteHexes.length < 8) {
          paletteHexes.push(slot.customColorHex);
          // No catalog paint — fall back to the hex as the hover label.
          palette.push({
            hex: slot.customColorHex,
            label: slot.customColorHex,
          });
        }
        if (richSlots.length < perRecipeSlotCap) {
          richSlots.push({
            hex: slot.customColorHex,
            paintLabel: null,
            layerLabel: layerLabelFor(slot.technique),
            coverage: "none",
            needsPaint: true,
          });
        }
      }
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
      palette,
      slots: richSlots,
      slotCount: slots.length,
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

  const slotRows = await db
    .select({
      recipeId: recipeSlots.recipeId,
      position: recipeSlots.position,
      paintId: recipeSlots.paintId,
      customColorHex: recipeSlots.customColorHex,
    })
    .from(recipeSlots)
    .where(inArray(recipeSlots.recipeId, allRecipeIds))
    .orderBy(asc(recipeSlots.recipeId), asc(recipeSlots.position));

  const slotsByRecipeId = new Map<
    string,
    Array<{ paintId: string | null; customColorHex: string | null }>
  >();
  for (const s of slotRows) {
    const arr = slotsByRecipeId.get(s.recipeId) ?? [];
    arr.push({ paintId: s.paintId, customColorHex: s.customColorHex });
    slotsByRecipeId.set(s.recipeId, arr);
  }

  const paintHex = await getPaintHexMap();
  const out = new Map<string, string[]>();
  for (const [projectId, recipeIds] of recipesByProject) {
    const hexes: string[] = [];
    for (const rid of recipeIds) {
      const slots = slotsByRecipeId.get(rid) ?? [];
      for (const slot of slots) {
        if (slot.customColorHex) {
          hexes.push(slot.customColorHex);
        } else if (slot.paintId) {
          const hex = paintHex.get(slot.paintId);
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
  /** Manufacturer / paint-line owner (Citadel, Vallejo, …). Used by the
   *  public gallery's brand facet — distinct from `label`, which is the
   *  combined "Brand Name" display string. */
  brand: string;
}

let paintMetaCache: Map<string, PaintMeta> | null = null;
let paintHexCache: Map<string, string> | null = null;
/** Cache key: the catalog file's mtime in ms. -1 = cold. */
let paintCacheMtimeMs = -1;

function catalogPath(): string {
  return resolve(process.cwd(), "public", "data", "paints.json");
}

/**
 * Server-side: read the static paint catalog from disk and build a
 * `paintId -> { hex, label }` map.
 *
 * Perf (perf-lag fix): the catalog is a static ~1.6 MB / 7k-row file
 * that only changes on a scrape rebuild. The old cache keyed on
 * `__exported_at`, which forced a full `readFile` + `JSON.parse`
 * (~5 ms hot, far worse on a cold serverless disk) on EVERY call just
 * to read the timestamp — making the "cache" pay the whole I/O + parse
 * cost it was meant to avoid. Every recipe / project / library render,
 * plus the post-mutation `revalidatePath` re-render, hit this. We now
 * key on the file's `mtime` via a `stat` (~0.008 ms, ~600× cheaper than
 * the read+parse) and skip `readFile` + `JSON.parse` + the 7k-entry Map
 * rebuild entirely on a hit.
 */
export async function getPaintMetaMap(): Promise<Map<string, PaintMeta>> {
  const file = catalogPath();
  let mtimeMs = -1;
  try {
    mtimeMs = (await stat(file)).mtimeMs;
    if (paintMetaCache && mtimeMs === paintCacheMtimeMs) {
      return paintMetaCache;
    }
  } catch {
    // stat failed (unexpected) — fall through to a full read so the
    // page still renders rather than throwing on a transient FS hiccup.
    if (paintMetaCache) return paintMetaCache;
  }

  const raw = await readFile(file, "utf8");
  const catalog = JSON.parse(raw) as PaintCatalog;
  const meta = new Map<string, PaintMeta>();
  const hex = new Map<string, string>();
  for (const p of catalog.paints as ReadonlyArray<Paint>) {
    meta.set(p.id, { hex: p.hex, label: `${p.brand} ${p.name}`, brand: p.brand });
    hex.set(p.id, p.hex);
  }
  paintMetaCache = meta;
  paintHexCache = hex;
  paintCacheMtimeMs = mtimeMs;
  return meta;
}

/**
 * `paintId -> hex` map. Derived alongside the meta map and cached in
 * lockstep, so the palette-strip callers (recipes table, project
 * palettes, public OG image) no longer rebuild a 7k-entry Map on every
 * call the way the old `for (const … of meta)` rebuild did.
 */
async function getPaintHexMap(): Promise<Map<string, string>> {
  await getPaintMetaMap();
  if (paintHexCache) return paintHexCache;
  // Defensive: meta resolved but hex cache somehow unset — derive once.
  const meta = paintMetaCache ?? new Map<string, PaintMeta>();
  const out = new Map<string, string>();
  for (const [id, m] of meta) out.set(id, m.hex);
  paintHexCache = out;
  return out;
}

/**
 * Derive the dominant swatch hex for each slot — the slot's paint hex OR
 * customColorHex. Used by the public OG image + palette strips.
 *
 * Returns a map keyed by the slot's `id`; consumers just walk the values
 * for an ordered palette strip.
 */
export async function paletteForRecipe(
  recipe: RecipeWithSlots,
): Promise<Map<string, string>> {
  const paintHex = await getPaintHexMap();
  const out = new Map<string, string>();
  for (const slot of recipe.slots) {
    let hex: string | null = null;
    if (slot.customColorHex) {
      hex = slot.customColorHex;
    } else if (slot.paintId) {
      hex = paintHex.get(slot.paintId) ?? null;
    }
    if (!hex) continue;
    out.set(slot.id, hex);
  }
  return out;
}

/**
 * Compact palette strip — up to `limit` swatch hexes in slot order.
 * Skips slots with no resolved colour. Used by `RecipeCard` +
 * `ProjectRow` to render a tiny strip without loading the full recipe.
 */
export async function paletteStripForRecipe(
  userId: string,
  recipeId: string,
  limit = 8,
): Promise<ReadonlyArray<string>> {
  const recipe = await getRecipeWithSlots(userId, recipeId);
  if (!recipe) return [];
  const map = await paletteForRecipe(recipe);
  return Array.from(map.values()).slice(0, limit);
}

/**
 * Bulk palette strips for many recipes in 2 SQL queries total — owner
 * check on the recipes (1 query) + slots (1 query keyed by recipe).
 * Avoids the N+1 explosion the per-card `paletteStripForRecipe` would
 * cause when the projects list renders a strip per project.
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

  const slotRows = await db
    .select()
    .from(recipeSlots)
    .where(inArray(recipeSlots.recipeId, ownedIds))
    .orderBy(asc(recipeSlots.recipeId), asc(recipeSlots.position));

  const paintHex = await getPaintHexMap();
  const slotsByRecipe = new Map<string, RecipeSlot[]>();
  for (const s of slotRows) {
    const arr = slotsByRecipe.get(s.recipeId) ?? [];
    arr.push(s);
    slotsByRecipe.set(s.recipeId, arr);
  }

  for (const id of ownedIds) {
    const slots = slotsByRecipe.get(id) ?? [];
    const swatches: string[] = [];
    for (const slot of slots) {
      const hex =
        slot.customColorHex ??
        (slot.paintId ? paintHex.get(slot.paintId) ?? null : null);
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
  slotCount: number;
}

export async function summarizeRecipe(
  userId: string,
  recipeId: string,
): Promise<RecipeSummary> {
  const recipe = await getRecipeWithSlots(userId, recipeId);
  if (!recipe) return { slotCount: 0 };
  return { slotCount: recipe.slots.length };
}

/* ============================================================
   Public gallery — published recipes browse surface
   ============================================================
   The public `/gallery` page lists every recipe that has been
   shared (its `publicSlug` is minted). This is the SINGLE leak
   guard: the SELECT below filters `publicSlug IS NOT NULL`, so a
   private recipe (slug = null) is never returned. No owner handle
   is exposed — the gallery is anonymous, mirroring the `/r/<slug>`
   view which also never surfaces the author.
   ============================================================ */

/** One card on the public gallery grid. */
export interface GalleryRecipeCard {
  /** The public slug — the card links to `/r/<slug>`. */
  slug: string;
  name: string;
  bodyType: Recipe["bodyType"];
  /** Up to 12 swatch hexes in slot-position order — the colour strip. */
  swatches: string[];
  /** Distinct brands across the recipe's catalog paints, sorted. Custom
   *  colour-only slots contribute no brand. Drives the brand facet. */
  brands: string[];
  /** Total slot count (one paint + layer per slot). */
  slotCount: number;
  /** ms-timestamp of publish-adjacent recency (the recipe's updatedAt). */
  updatedAt: number;
}

/**
 * Every published recipe, newest first, resolved into gallery cards.
 *
 * Two SQL reads total — published recipes (1), then their slots (1) —
 * plus the cached paint catalog for hex + brand resolution. Capped at
 * `limit` recipes so the grid stays bounded; per-recipe swatch strip is
 * capped at `swatchCap`.
 *
 * Leak guard: `isNotNull(recipes.publicSlug)` — only shared recipes are
 * ever selected, so a private recipe can never appear in the gallery.
 */
export async function listPublishedRecipes(
  limit = 60,
  swatchCap = 12,
): Promise<ReadonlyArray<GalleryRecipeCard>> {
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(isNotNull(recipes.publicSlug))
    .orderBy(desc(recipes.updatedAt))
    .limit(limit);

  if (recipeRows.length === 0) return [];

  const recipeIds = recipeRows.map((r) => r.id);
  const slotRows = await db
    .select()
    .from(recipeSlots)
    .where(inArray(recipeSlots.recipeId, recipeIds))
    .orderBy(asc(recipeSlots.recipeId), asc(recipeSlots.position));

  const slotsByRecipeId = new Map<string, RecipeSlot[]>();
  for (const s of slotRows) {
    const arr = slotsByRecipeId.get(s.recipeId) ?? [];
    arr.push(s);
    slotsByRecipeId.set(s.recipeId, arr);
  }

  const paintMeta = await getPaintMetaMap();

  const out: GalleryRecipeCard[] = [];
  for (const r of recipeRows) {
    // publicSlug is guaranteed non-null by the WHERE filter, but narrow
    // for the type system rather than asserting.
    if (!r.publicSlug) continue;
    const slots = slotsByRecipeId.get(r.id) ?? [];
    const swatches: string[] = [];
    const brandSet = new Set<string>();
    for (const slot of slots) {
      if (slot.paintId) {
        const meta = paintMeta.get(slot.paintId);
        if (meta) {
          if (swatches.length < swatchCap) swatches.push(meta.hex);
          if (meta.brand) brandSet.add(meta.brand);
        }
      } else if (slot.customColorHex) {
        if (swatches.length < swatchCap) swatches.push(slot.customColorHex);
      }
    }
    out.push({
      slug: r.publicSlug,
      name: r.name,
      bodyType: r.bodyType,
      swatches,
      brands: Array.from(brandSet).sort((a, b) => a.localeCompare(b)),
      slotCount: slots.length,
      updatedAt: r.updatedAt.getTime(),
    });
  }
  return out;
}

/* ============================================================
   Slot internal lookups (used by mutations)
   ============================================================ */

/**
 * Verify a slot exists and is owned via its parent recipe (2026-06-04
 * unify). Returns the slot row + the parent recipeId on success.
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
