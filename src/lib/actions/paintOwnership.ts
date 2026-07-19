"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUserId } from "@/lib/auth-stub";
import { getServerCatalog } from "@/lib/paints/serverCatalog";
import { reconcilePaintOwnership } from "@/lib/paints/reconcileOwnership";
import { ownershipStatuses, bulkOwnershipStatuses } from "@/lib/paints/ownership";
import type { ActionResult } from "@/lib/actions/projects";
import type { WishlistItem } from "@/db/schema";

/**
 * Library-side ownership writes (batch/library-collection-sync). Both
 * actions funnel through `reconcilePaintOwnership` — the single place
 * that keeps `inventory_entry` and the linked `wishlist_item` row in
 * sync — so setting a paint's status here also creates/updates/removes
 * its Collection row.
 */

const paintIdSchema = z.string().min(1).max(64);

const setStatusSchema = z.object({
  paintId: paintIdSchema,
  status: z.enum(ownershipStatuses),
});

export interface PaintOwnershipResult {
  paintId: string;
  ownedCount: number;
  isWishlisted: boolean;
  linkedItemId: string | null;
}

/** The Library paint side-panel's STATUS control (NONE/WISHLIST/OWNED). */
export async function setPaintOwnershipStatus(
  raw: z.infer<typeof setStatusSchema>,
): Promise<ActionResult<PaintOwnershipResult>> {
  const parsed = setStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { paintId, status } = parsed.data;
  const userId = await currentUserId();

  try {
    const { inventory, linkedItem } = await reconcilePaintOwnership(userId, paintId, status);
    revalidatePath("/library");
    revalidatePath("/collection");
    return {
      ok: true,
      data: {
        paintId,
        ownedCount: inventory.ownedCount,
        isWishlisted: inventory.isWishlisted,
        linkedItemId: linkedItem?.id ?? null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update paint status",
    };
  }
}

const bulkAddSchema = z.object({
  paintIds: z.array(paintIdSchema).min(1).max(500),
  status: z.enum(bulkOwnershipStatuses),
});

/** The Library grid's multi-select "Add to Collection ▸ OWNED / ▸ WISHLIST"
 *  bulk action bar — also the confirmed-matches write path for "Scan paints
 *  from a photo" (src/lib/actions/paintScan.ts only extracts + matches; this
 *  is the one place that actually persists). Loads the catalog once and
 *  reuses it across every paint in the selection instead of re-reading
 *  paints.json per row. `items` returns each linked Collection row so a
 *  caller can drop the freshly written rows straight into local state
 *  without a round-trip (`count` is kept for existing callers that only
 *  need the tally). */
export async function bulkAddPaintsToCollection(
  raw: z.infer<typeof bulkAddSchema>,
): Promise<ActionResult<{ count: number; items: WishlistItem[] }>> {
  const parsed = bulkAddSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { paintIds, status } = parsed.data;
  const userId = await currentUserId();

  try {
    const catalog = await getServerCatalog();
    const items: WishlistItem[] = [];
    for (const paintId of paintIds) {
      const { linkedItem } = await reconcilePaintOwnership(userId, paintId, status, { catalog });
      if (linkedItem) items.push(linkedItem);
    }
    revalidatePath("/library");
    revalidatePath("/collection");
    return { ok: true, data: { count: paintIds.length, items } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add paints to collection",
    };
  }
}
