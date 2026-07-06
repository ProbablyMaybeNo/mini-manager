import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inventoryEntries, type InventoryEntry } from "@/db/schema";

/**
 * Select-then-update-or-insert against the `inventory_owner_paint_unique`
 * index. The single write path for `inventory_entry` rows — both the
 * inventory server actions (setOwnedCount / toggleWishlistedPaint /
 * markPurchased) and `reconcilePaintOwnership`
 * (src/lib/paints/reconcileOwnership.ts) go through this so there is one
 * place that knows how to create-or-patch a row for (owner, paint).
 */
export async function upsertInventoryEntry(
  userId: string,
  paintId: string,
  patch: Partial<Pick<InventoryEntry, "ownedCount" | "isWishlisted" | "lastPurchasedAt">>,
): Promise<InventoryEntry> {
  const existing = await db
    .select()
    .from(inventoryEntries)
    .where(
      and(eq(inventoryEntries.ownerId, userId), eq(inventoryEntries.paintId, paintId)),
    )
    .limit(1);

  const current = existing[0];
  if (current) {
    const updated = await db
      .update(inventoryEntries)
      .set(patch)
      .where(eq(inventoryEntries.id, current.id))
      .returning();
    const row = updated[0];
    if (!row) throw new Error("Update returned no row");
    return row;
  }
  const inserted = await db
    .insert(inventoryEntries)
    .values({
      ownerId: userId,
      paintId,
      ownedCount: patch.ownedCount ?? 0,
      isWishlisted: patch.isWishlisted ?? false,
      lastPurchasedAt: patch.lastPurchasedAt ?? null,
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new Error("Insert returned no row");
  return row;
}

/**
 * Full inventory map for a user. Returned as a Map keyed by paintId so
 * the library table can do O(1) lookups per row. Empty paintIds (paints
 * the user has never interacted with) simply aren't in the map.
 */
export async function listInventoryByUser(
  userId: string,
): Promise<Map<string, InventoryEntry>> {
  const rows = await db
    .select()
    .from(inventoryEntries)
    .where(eq(inventoryEntries.ownerId, userId));
  const out = new Map<string, InventoryEntry>();
  for (const row of rows) out.set(row.paintId, row);
  return out;
}

export async function getInventoryEntry(
  userId: string,
  paintId: string,
): Promise<InventoryEntry | null> {
  const rows = await db
    .select()
    .from(inventoryEntries)
    .where(
      and(
        eq(inventoryEntries.ownerId, userId),
        eq(inventoryEntries.paintId, paintId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
