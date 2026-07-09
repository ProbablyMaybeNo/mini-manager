"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { inventoryEntries, type InventoryEntry } from "@/db/schema";
import { getInventoryEntry, upsertInventoryEntry } from "@/db/queries/inventory";
import { currentUserId } from "@/lib/auth-stub";
import { loadInventoryFlags } from "@/lib/appData";
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

/**
 * LAYERING "MATCH" button — the owned-first grounding toggle. Lightweight
 * read action surfaced directly to the client tool (same pattern as
 * `listRecipesForSendTo`): the owned paint ids only, not the full
 * {@link InventoryFlags} shape, since that's all the grounding toggle needs.
 * Resolves the user via `currentUserId()` like every sibling action (importing
 * `@/auth` here pulls next-auth's `next/server` into this server-action module
 * and breaks the integration suite's import). The try/catch swallows the
 * signed-out redirect, so a guest still just gets an empty set.
 */
export async function loadOwnedPaintIds(): Promise<ActionResult<string[]>> {
  try {
    const userId = await currentUserId();
    const flags = await loadInventoryFlags(userId);
    return { ok: true, data: flags.ownedIds };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load owned paints",
    };
  }
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
    const row = await upsertInventoryEntry(userId, paintId, { ownedCount: count });
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
    const row = await upsertInventoryEntry(userId, paintId, { isWishlisted: nextValue });
    revalidatePath("/library");
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to toggle wishlist",
    };
  }
}

export interface AssignInventoryResult {
  entry: InventoryEntry;
  /** True when the paint was already in this state and the write was
   *  skipped — Owned already had a count ≥1 (no-clobber), or the paint was
   *  already on the wishlist (no re-toggle). The caller uses this to pick
   *  an "already…" vs. a fresh success toast. */
  already: boolean;
}

/**
 * ASSIGN-menu "Add to Owned" (AssignPaintMenu). Wraps {@link setOwnedCount}
 * with a no-clobber guard: a painter who already owns 3 of a paint must not
 * get reset to 1 by a stray menu click, so this reads the current count
 * first and only ever raises it to at least 1.
 */
export async function addPaintToOwned(
  raw: z.infer<typeof toggleWishlistSchema>,
): Promise<ActionResult<AssignInventoryResult>> {
  const parsed = toggleWishlistSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { paintId } = parsed.data;
  const userId = await currentUserId();
  try {
    const existing = await getInventoryEntry(userId, paintId);
    if (existing && existing.ownedCount > 0) {
      return { ok: true, data: { entry: existing, already: true } };
    }
    const result = await setOwnedCount({ paintId, count: Math.max(1, existing?.ownedCount ?? 0) });
    if (!result.ok) return result;
    return { ok: true, data: { entry: result.data, already: false } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to mark owned",
    };
  }
}

/**
 * ASSIGN-menu "Add to Wishlist" (AssignPaintMenu). {@link toggleWishlistedPaint}
 * is a pure toggle, so a stray click on an already-wishlisted paint would
 * turn it back off — this checks first and only calls the toggle when the
 * paint isn't already on the wishlist.
 */
export async function addPaintToWishlist(
  raw: z.infer<typeof toggleWishlistSchema>,
): Promise<ActionResult<AssignInventoryResult>> {
  const parsed = toggleWishlistSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { paintId } = parsed.data;
  const userId = await currentUserId();
  try {
    const existing = await getInventoryEntry(userId, paintId);
    if (existing?.isWishlisted) {
      return { ok: true, data: { entry: existing, already: true } };
    }
    const result = await toggleWishlistedPaint({ paintId });
    if (!result.ok) return result;
    return { ok: true, data: { entry: result.data, already: false } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add to wishlist",
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
    const row = await upsertInventoryEntry(userId, paintId, {
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
