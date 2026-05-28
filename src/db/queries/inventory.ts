import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inventoryEntries, type InventoryEntry } from "@/db/schema";

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
