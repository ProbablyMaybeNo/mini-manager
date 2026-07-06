import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  wishlistItems,
  type CollectionPaintType,
  type InventoryEntry,
  type WishlistItem,
  type WishlistStatus,
} from "@/db/schema";
import { upsertInventoryEntry, getInventoryEntry } from "@/db/queries/inventory";
import { getServerCatalog } from "@/lib/paints/serverCatalog";
import type { Paint, PaintType } from "@/lib/paints/types";
import type { OwnershipStatus } from "@/lib/paints/ownership";

/**
 * Library ↔ Collection sync (batch/library-collection-sync).
 *
 * `inventory_entry` (fast owned/wishlist booleans, ~8 call sites: library
 * flags/filters, paint coverage, export) and `wishlist_item` (kind='paint',
 * the rich Collection line: title/company/price/project/…) used to be
 * fully independent. This module is the SINGLE place that writes ownership
 * to either table — every Library STATUS control, the bulk "Add to
 * Collection" action, and the Collection paint row's own status
 * dropdown/delete all funnel through the functions here, so the two
 * stores can never drift out of sync.
 *
 * `reconcilePaintOwnership` is the Library-side entry point: given a
 * (owner, paintId) pair and a target tri-state, it updates
 * `inventory_entry` AND upserts/removes the single linked `wishlist_item`
 * row for that paint. `applyOwnershipToInventory` is the lighter,
 * one-directional half used by the Collection side (src/lib/actions/
 * wishlist.ts) when a linked row's OWN status changes or the row is
 * deleted — it only touches `inventory_entry`, since the `wishlist_item`
 * row in that case is the one the caller is already editing directly.
 */

/** Catalog PaintType → the Collection paint table's `paintType` enum.
 *  Lacquer has no direct analogue in `collectionPaintTypes`, so it falls
 *  back to "Other" rather than silently mis-labelling it. */
const CATALOG_TO_COLLECTION_PAINT_TYPE: Record<PaintType, CollectionPaintType> = {
  Paint: "Acrylic",
  Wash: "Wash",
  Metallic: "Metallic",
  Contrast: "Contrast",
  Air: "Air",
  Primer: "Primer",
  Varnish: "Varnish",
  Pigment: "Pigment",
  Effect: "Effect",
  Ink: "Ink",
  Lacquer: "Other",
};

/** Find a catalog paint by id. Accepts an optional pre-loaded catalog
 *  (bulk callers load it once and pass it to every call) — falls back to
 *  `getServerCatalog()` (mtime-cached) when omitted. */
async function findCatalogPaint(
  paintId: string,
  catalog?: ReadonlyArray<Paint>,
): Promise<Paint | null> {
  const paints = catalog ?? (await getServerCatalog());
  return paints.find((p) => p.id === paintId) ?? null;
}

/** DB wishlist status → the tri-state ownership vocabulary. Only
 *  WISHLIST / OWNED / PURCHASED / HOLD are ever realistic on a paint-kind
 *  row (see `paintCollectionStatuses`); HOLD and anything else read as
 *  "not currently tracked as owned or wanted" for Library purposes. */
function toOwnershipStatus(status: WishlistStatus): OwnershipStatus {
  if (status === "WISHLIST") return "WISHLIST";
  if (status === "OWNED" || status === "PURCHASED") return "OWNED";
  return "NONE";
}

/** Ownership status → the DB status a linked paint row should carry.
 *  NONE has no wishlist_item representation (the row is deleted instead
 *  — paintCollectionStatuses has no neutral "untracked" value). */
function toDbStatus(status: Exclude<OwnershipStatus, "NONE">): WishlistStatus {
  return status === "OWNED" ? "OWNED" : "WISHLIST";
}

/**
 * Apply a tri-state ownership status to `inventory_entry` for (owner,
 * paintId). WISHLIST and OWNED are mutually exclusive at this layer —
 * matches the single `status` column the linked Collection row carries.
 * Any pre-existing `ownedCount` > 0 is preserved when re-affirming OWNED
 * (so a painter who owns 3 tubes doesn't get reset to 1 by a bulk action);
 * turning OWNED off zeroes it, same as WISHLIST/NONE.
 */
export async function applyOwnershipToInventory(
  ownerId: string,
  paintId: string,
  status: OwnershipStatus,
): Promise<InventoryEntry> {
  const current = await getInventoryEntry(ownerId, paintId);
  const patch =
    status === "OWNED"
      ? { ownedCount: current && current.ownedCount > 0 ? current.ownedCount : 1, isWishlisted: false }
      : status === "WISHLIST"
        ? { ownedCount: 0, isWishlisted: true }
        : { ownedCount: 0, isWishlisted: false };
  return upsertInventoryEntry(ownerId, paintId, patch);
}

/**
 * Load the single linked `wishlist_item` row for (owner, paintId), if
 * any, deduping defensively: a linked paint should have at most one row,
 * but if two ever exist (a bug, a race, a bad backfill match) this keeps
 * the oldest and deletes the rest so callers never have to reason about
 * "which one".
 */
async function loadLinkedRow(
  ownerId: string,
  paintId: string,
): Promise<WishlistItem | null> {
  const rows = await db
    .select()
    .from(wishlistItems)
    .where(
      and(
        eq(wishlistItems.ownerId, ownerId),
        eq(wishlistItems.kind, "paint"),
        eq(wishlistItems.paintId, paintId),
      ),
    )
    .orderBy(wishlistItems.dateAdded);

  if (rows.length <= 1) return rows[0] ?? null;

  const [keep, ...extras] = rows;
  for (const extra of extras) {
    await db.delete(wishlistItems).where(eq(wishlistItems.id, extra.id));
  }
  return keep ?? null;
}

/**
 * Upsert-or-remove the single linked Collection row for (owner, paintId)
 * to match the target ownership status.
 *
 *  - NONE removes the linked row entirely (there's no neutral status
 *    value a linked row can hold, and the Library no longer wants this
 *    paint tracked at all).
 *  - WISHLIST / OWNED: updates the existing linked row's status in place
 *    (preserving title/company/price/project — a manual edit on a linked
 *    row must survive a status change), or creates a new row filled from
 *    the catalog (title/company/paintType) with price left null (MANUAL
 *    pricing — Phase 2 adds scraping) when none exists yet.
 */
async function syncLinkedCollectionRow(
  ownerId: string,
  paintId: string,
  status: OwnershipStatus,
  catalog?: ReadonlyArray<Paint>,
): Promise<WishlistItem | null> {
  const existing = await loadLinkedRow(ownerId, paintId);

  if (status === "NONE") {
    if (existing) {
      await db.delete(wishlistItems).where(eq(wishlistItems.id, existing.id));
    }
    return null;
  }

  const dbStatus = toDbStatus(status);
  const dateResolved = dbStatus === "WISHLIST" ? null : new Date();

  if (existing) {
    const updated = await db
      .update(wishlistItems)
      .set({ status: dbStatus, dateResolved })
      .where(eq(wishlistItems.id, existing.id))
      .returning();
    return updated[0] ?? existing;
  }

  const paint = await findCatalogPaint(paintId, catalog);
  const inserted = await db
    .insert(wishlistItems)
    .values({
      ownerId,
      kind: "paint",
      paintId,
      title: paint?.name ?? paintId,
      company: paint?.brand ?? null,
      paintType: paint ? CATALOG_TO_COLLECTION_PAINT_TYPE[paint.type] : null,
      price: null,
      status: dbStatus,
      dateResolved,
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new Error("Insert returned no row");
  return row;
}

export interface ReconcileResult {
  inventory: InventoryEntry;
  linkedItem: WishlistItem | null;
}

/**
 * The single entry point for every Library-side ownership write. Updates
 * `inventory_entry` AND the linked `wishlist_item` row for (owner,
 * paintId) atomically from the caller's point of view (both writes
 * complete or the caller sees the thrown error — SQLite/libsql
 * auto-commits each statement, there's no explicit transaction wrapper
 * here since neither write can partially fail in a way the other cares
 * about). Idempotent: calling it twice with the same status is a no-op
 * the second time.
 *
 * `catalog` lets bulk callers (the Library's "Add to Collection" action)
 * load `paints.json` once and pass it to every call instead of re-reading
 * it per paint.
 */
export async function reconcilePaintOwnership(
  ownerId: string,
  paintId: string,
  status: OwnershipStatus,
  opts: { catalog?: ReadonlyArray<Paint> } = {},
): Promise<ReconcileResult> {
  const inventory = await applyOwnershipToInventory(ownerId, paintId, status);
  const linkedItem = await syncLinkedCollectionRow(ownerId, paintId, status, opts.catalog);
  return { inventory, linkedItem };
}

/**
 * The Collection-side half: a linked paint row's status changed (or the
 * row was deleted) directly through the Collection UI. Reflects that into
 * `inventory_entry` WITHOUT touching `wishlist_item` — the caller already
 * owns that write (it's editing the row directly), so re-running
 * `syncLinkedCollectionRow` here would be redundant and risk clobbering
 * an in-flight edit.
 */
export async function reflectCollectionStatusToInventory(
  ownerId: string,
  paintId: string,
  dbStatus: WishlistStatus,
): Promise<InventoryEntry> {
  return applyOwnershipToInventory(ownerId, paintId, toOwnershipStatus(dbStatus));
}

/**
 * Same as `reflectCollectionStatusToInventory` but for a row being
 * removed entirely — clears both inventory flags.
 */
export async function reflectCollectionRemovalToInventory(
  ownerId: string,
  paintId: string,
): Promise<InventoryEntry> {
  return applyOwnershipToInventory(ownerId, paintId, "NONE");
}

/**
 * `appData.loadInventoryFlags`'s other half — the linked-Collection-row
 * statuses for a user, so a paint marked OWNED/WISHLIST ONLY on its
 * Collection row (not yet mirrored to inventory_entry, e.g. rows the
 * backfill script attaches) still shows the right flag in the Library.
 * Guards `isNotNull` + excludes rows the reconcile loop never produces
 * (kind is always 'paint' when paintId is set, but the filter is
 * defensive against any future non-reconcile write path).
 */
export async function listLinkedPaintStatuses(
  ownerId: string,
): Promise<Map<string, OwnershipStatus>> {
  const rows = await db
    .select({ paintId: wishlistItems.paintId, status: wishlistItems.status })
    .from(wishlistItems)
    .where(
      and(
        eq(wishlistItems.ownerId, ownerId),
        eq(wishlistItems.kind, "paint"),
        isNotNull(wishlistItems.paintId),
      ),
    );
  const out = new Map<string, OwnershipStatus>();
  for (const row of rows) {
    if (!row.paintId) continue;
    const mapped = toOwnershipStatus(row.status);
    if (mapped !== "NONE") out.set(row.paintId, mapped);
  }
  return out;
}
