import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  recipes,
  recipeSlots,
  wishlistItems,
  type WishlistItem,
} from "@/db/schema";
import { getPaintMetaMap } from "@/db/queries/recipes";

/* ============================================================
   COLLECTIONS page queries
   ============================================================
   The COLLECTIONS surface (formerly /wishlist) renders two tables off
   the single `wishlist_item` table, partitioned by `kind`:

     PAINT COLLECTION  — kind = 'paint'
     MODEL COLLECTION  — kind = 'model'

   These helpers fetch each partition (with per-table filters), the
   bottom stats bar, and the paint→recipe linkage that powers the paint
   table's RECIPE column.
   ============================================================ */

export interface PaintCollectionFilters {
  /** Paint status filter — WISHLIST / OWNED / HOLD, or null for all. */
  status?: string | null;
  /** Paint medium type filter (Contrast / Wash / …), or null for all. */
  paintType?: string | null;
}

export interface ModelCollectionFilters {
  /** Model status filter (WISHLIST / OWNED / BUILT / …), or null for all. */
  status?: string | null;
  /** Project assignment filter (a project id), or null for all. */
  projectId?: string | null;
}

/** Normalise a paint label/title for fuzzy matching against recipe
 *  slots: lowercase, collapse whitespace, strip a leading brand-ish
 *  marker is intentionally NOT done — we match on the full string and
 *  also on a brandless tail (see buildRecipesByPaintTitle). */
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/* ---------- PAINT COLLECTION ---------- */

export async function listPaintCollection(
  userId: string,
  opts: PaintCollectionFilters = {},
): Promise<ReadonlyArray<WishlistItem>> {
  const filters = [
    eq(wishlistItems.ownerId, userId),
    eq(wishlistItems.kind, "paint"),
  ];
  if (opts.status) filters.push(eq(wishlistItems.status, opts.status as never));
  if (opts.paintType) {
    filters.push(eq(wishlistItems.paintType, opts.paintType));
  }
  return db
    .select()
    .from(wishlistItems)
    .where(and(...filters))
    .orderBy(desc(wishlistItems.dateAdded));
}

/* ---------- MODEL COLLECTION ---------- */

export async function listModelCollection(
  userId: string,
  opts: ModelCollectionFilters = {},
): Promise<ReadonlyArray<WishlistItem>> {
  const filters = [
    eq(wishlistItems.ownerId, userId),
    eq(wishlistItems.kind, "model"),
  ];
  if (opts.status) filters.push(eq(wishlistItems.status, opts.status as never));
  if (opts.projectId) {
    filters.push(eq(wishlistItems.projectId, opts.projectId));
  }
  return db
    .select()
    .from(wishlistItems)
    .where(and(...filters))
    .orderBy(desc(wishlistItems.dateAdded));
}

/* ---------- Paint → recipe linkage (RECIPE column) ---------- */

/**
 * Build a map of `normalised paint label/title -> recipe names[]` for a
 * user. Powers the PAINT COLLECTION's RECIPE column: each paint row
 * matches its title against this map to list the recipes the paint is
 * used in.
 *
 * Recipe slots pin paints by `paintId` (a paints.json id). We resolve
 * each pinned paint to its catalog label (`"${brand} ${name}"`) and key
 * the map by both the full label and a brandless tail (the paint name on
 * its own), since a painter's manually-added wishlist title may be just
 * the paint name without the brand prefix.
 */
export async function buildRecipesByPaintTitle(
  userId: string,
): Promise<Map<string, string[]>> {
  const recipeRows = await db
    .select({ id: recipes.id, name: recipes.name })
    .from(recipes)
    .where(eq(recipes.ownerId, userId));
  if (recipeRows.length === 0) return new Map();

  const nameById = new Map(recipeRows.map((r) => [r.id, r.name]));

  const slotRows = await db
    .select({
      recipeId: recipeSlots.recipeId,
      paintId: recipeSlots.paintId,
    })
    .from(recipeSlots);

  const meta = await getPaintMetaMap();
  const out = new Map<string, string[]>();

  const add = (key: string, recipeName: string) => {
    const k = norm(key);
    if (!k) return;
    const arr = out.get(k) ?? [];
    if (!arr.includes(recipeName)) arr.push(recipeName);
    out.set(k, arr);
  };

  for (const slot of slotRows) {
    if (!slot.paintId) continue;
    const recipeName = nameById.get(slot.recipeId);
    if (!recipeName) continue; // slot belongs to another user's recipe
    const paint = meta.get(slot.paintId);
    if (!paint) continue;
    add(paint.label, recipeName);
    // Brandless tail: drop the first whitespace-delimited token (brand)
    // so "Citadel Mephiston Red" also keys on "Mephiston Red".
    const tail = paint.label.split(" ").slice(1).join(" ");
    if (tail) add(tail, recipeName);
  }

  return out;
}

/** Resolve the recipe names a single paint title is used in, given the
 *  prebuilt map. Tries the full title then the brandless tail. */
export function recipesForPaintTitle(
  title: string,
  map: Map<string, string[]>,
): string[] {
  const full = map.get(norm(title));
  if (full && full.length) return full;
  const tail = title.split(" ").slice(1).join(" ");
  if (tail) {
    const t = map.get(norm(tail));
    if (t && t.length) return t;
  }
  return [];
}

/* ---------- Bottom stats bar ---------- */

export interface CollectionStats {
  /** Paints with status OWNED. */
  paintsOwned: number;
  /** Total paint rows. */
  paintsTotal: number;
  /** Model counts keyed by status (only non-zero buckets present). */
  modelsByStatus: Record<string, number>;
  /** Total model rows. */
  modelsTotal: number;
  /** Total spent (OWNED paints + acquired models) per currency. An item
   *  counts as "spent" once it leaves WISHLIST/HOLD — i.e. it's owned. */
  spentByCurrency: Record<string, number>;
}

/** A model row counts toward spend once it's at least OWNED (any stage
 *  past WISHLIST). Paints count once OWNED. */
const SPENT_STATUSES = new Set([
  "OWNED",
  "BUILT",
  "PRIMED",
  "PAINTED",
  "BASED",
  "COMPLETE",
  // legacy
  "PURCHASED",
]);

export async function collectionStats(userId: string): Promise<CollectionStats> {
  const rows = await db
    .select({
      kind: wishlistItems.kind,
      status: wishlistItems.status,
      price: wishlistItems.price,
      currency: wishlistItems.currency,
    })
    .from(wishlistItems)
    .where(eq(wishlistItems.ownerId, userId));

  let paintsOwned = 0;
  let paintsTotal = 0;
  let modelsTotal = 0;
  const modelsByStatus: Record<string, number> = {};
  const spentByCurrency: Record<string, number> = {};

  for (const r of rows) {
    if (r.kind === "paint") {
      paintsTotal += 1;
      if (r.status === "OWNED" || r.status === "PURCHASED") paintsOwned += 1;
    } else {
      modelsTotal += 1;
      modelsByStatus[r.status] = (modelsByStatus[r.status] ?? 0) + 1;
    }
    if (r.price !== null && SPENT_STATUSES.has(r.status)) {
      const code = r.currency ?? "USD";
      spentByCurrency[code] = (spentByCurrency[code] ?? 0) + r.price / 100;
    }
  }

  return {
    paintsOwned,
    paintsTotal,
    modelsByStatus,
    modelsTotal,
    spentByCurrency,
  };
}

/** Distinct paint medium types the user has on paint rows — for the
 *  paint table's type filter. */
export async function listPaintTypesInUse(
  userId: string,
): Promise<ReadonlyArray<string>> {
  const rows = await db
    .selectDistinct({ paintType: wishlistItems.paintType })
    .from(wishlistItems)
    .where(and(eq(wishlistItems.ownerId, userId), eq(wishlistItems.kind, "paint")))
    .orderBy(asc(wishlistItems.paintType));
  return rows.map((r) => r.paintType).filter((v): v is string => !!v);
}
