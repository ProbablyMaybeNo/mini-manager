"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { inventoryEntries, type InventoryEntry } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";

const paintIdSchema = z.string().min(1).max(64);

const setOwnedSchema = z.object({
  paintId: paintIdSchema,
  count: z.number().int().min(0).max(9999),
});
const toggleWishlistSchema = z.object({ paintId: paintIdSchema });
const markPurchasedSchema = z.object({
  paintId: paintIdSchema,
  deltaCount: z.number().int().min(1).max(999),
});

async function upsertInventory(
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

export async function setOwnedCount(
  raw: z.infer<typeof setOwnedSchema>,
): Promise<ActionResult<InventoryEntry>> {
  const parsed = setOwnedSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { paintId, count } = parsed.data;
  const userId = await currentUserId();
  try {
    const row = await upsertInventory(userId, paintId, { ownedCount: count });
    revalidatePath("/library");
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update inventory",
    };
  }
}

export async function toggleWishlistedPaint(
  raw: z.infer<typeof toggleWishlistSchema>,
): Promise<ActionResult<InventoryEntry>> {
  const parsed = toggleWishlistSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { paintId } = parsed.data;
  const userId = await currentUserId();

  try {
    const existing = await db
      .select()
      .from(inventoryEntries)
      .where(
        and(
          eq(inventoryEntries.ownerId, userId),
          eq(inventoryEntries.paintId, paintId),
        ),
      )
      .limit(1);
    const current = existing[0];
    const nextValue = current ? !current.isWishlisted : true;
    const row = await upsertInventory(userId, paintId, { isWishlisted: nextValue });
    revalidatePath("/library");
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to toggle wishlist",
    };
  }
}

export async function markPurchased(
  raw: z.infer<typeof markPurchasedSchema>,
): Promise<ActionResult<InventoryEntry>> {
  const parsed = markPurchasedSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { paintId, deltaCount } = parsed.data;
  const userId = await currentUserId();

  try {
    const existing = await db
      .select()
      .from(inventoryEntries)
      .where(
        and(
          eq(inventoryEntries.ownerId, userId),
          eq(inventoryEntries.paintId, paintId),
        ),
      )
      .limit(1);
    const currentOwned = existing[0]?.ownedCount ?? 0;
    const row = await upsertInventory(userId, paintId, {
      ownedCount: currentOwned + deltaCount,
      lastPurchasedAt: new Date(),
    });
    revalidatePath("/library");
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to mark purchase",
    };
  }
}
