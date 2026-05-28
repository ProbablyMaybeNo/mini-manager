"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  wishlistItems,
  wishlistCategories,
  wishlistStatuses,
  priorities,
  type WishlistItem,
} from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";
import { scrapeUrl } from "@/lib/scrape";

/* ============================================================
   Schemas
   ============================================================ */

const baseFields = {
  title: z.string().trim().min(1, "Title is required").max(240),
  imageUrl: z.string().url().nullish(),
  sourceUrl: z.string().url().nullish(),
  vendor: z.string().trim().max(120).nullish(),
  price: z.number().nonnegative().max(10_000_000).nullish(), // dollars (or chosen currency)
  currency: z
    .string()
    .trim()
    .length(3, "ISO 4217 currency code")
    .toUpperCase()
    .optional(),
  category: z.enum(wishlistCategories).optional(),
  priority: z.enum(priorities).optional(),
  projectId: z.string().min(1).max(64).nullish(),
  notesMd: z.string().max(10000).nullish(),
} as const;

const createSchema = z.object(baseFields);
export type CreateWishlistItemInput = z.infer<typeof createSchema>;

const updateSchema = z.object({ id: z.string().min(1).max(64), ...baseFields })
  .partial({
    title: true,
  });

const statusSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(wishlistStatuses),
});

/* ============================================================
   Helpers
   ============================================================ */

/** Convert nullable dollar price → integer cents for storage. */
function priceToCents(p: number | null | undefined): number | null {
  if (p === null || p === undefined) return null;
  return Math.round(p * 100);
}

/* ============================================================
   Actions
   ============================================================ */

export async function createWishlistItem(
  raw: CreateWishlistItemInput,
): Promise<ActionResult<WishlistItem>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await currentUserId();
  const d = parsed.data;
  try {
    const inserted = await db
      .insert(wishlistItems)
      .values({
        ownerId: userId,
        title: d.title,
        imageUrl: d.imageUrl ?? null,
        sourceUrl: d.sourceUrl ?? null,
        vendor: d.vendor ?? null,
        price: priceToCents(d.price ?? null),
        currency: d.currency ?? "USD",
        category: d.category ?? "Other",
        priority: d.priority ?? "Medium",
        projectId: d.projectId ?? null,
        notesMd: d.notesMd ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) return { ok: false, error: "Insert returned no row" };
    revalidatePath("/wishlist");
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create item",
    };
  }
}

export async function updateWishlistItem(
  raw: z.infer<typeof updateSchema>,
): Promise<ActionResult<WishlistItem>> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await currentUserId();
  const { id, ...patch } = parsed.data;

  // Ownership check + ensure the row exists.
  const existing = await db
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.id, id), eq(wishlistItems.ownerId, userId)))
    .limit(1);
  if (!existing[0]) return { ok: false, error: "Item not found" };

  const patchValues: Partial<typeof wishlistItems.$inferInsert> = {};
  if (patch.title !== undefined) patchValues.title = patch.title;
  if (patch.imageUrl !== undefined) patchValues.imageUrl = patch.imageUrl ?? null;
  if (patch.sourceUrl !== undefined) patchValues.sourceUrl = patch.sourceUrl ?? null;
  if (patch.vendor !== undefined) patchValues.vendor = patch.vendor ?? null;
  if (patch.price !== undefined) patchValues.price = priceToCents(patch.price ?? null);
  if (patch.currency !== undefined) patchValues.currency = patch.currency;
  if (patch.category !== undefined) patchValues.category = patch.category;
  if (patch.priority !== undefined) patchValues.priority = patch.priority;
  if (patch.projectId !== undefined) patchValues.projectId = patch.projectId ?? null;
  if (patch.notesMd !== undefined) patchValues.notesMd = patch.notesMd ?? null;

  try {
    const updated = await db
      .update(wishlistItems)
      .set(patchValues)
      .where(eq(wishlistItems.id, id))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, error: "Update returned no row" };
    revalidatePath("/wishlist");
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update item",
    };
  }
}

export async function deleteWishlistItem(
  raw: { id: string },
): Promise<ActionResult<{ id: string }>> {
  const id = z.string().min(1).max(64).safeParse(raw.id);
  if (!id.success) return { ok: false, error: "Invalid id" };
  const userId = await currentUserId();
  try {
    await db
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.id, id.data), eq(wishlistItems.ownerId, userId)));
    revalidatePath("/wishlist");
    return { ok: true, data: { id: id.data } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete item",
    };
  }
}

/**
 * Scrape a vendor URL and create a wishlist row populated with whatever
 * the parser produced. Falls back to a minimal row (title=hostname,
 * sourceUrl set) so a painter pasting URLs in bulk never gets stuck on
 * a broken parse.
 */
export async function scrapeAndCreateWishlistItem(
  raw: { url: string },
): Promise<ActionResult<WishlistItem>> {
  const urlParse = z
    .string()
    .url()
    .safeParse(raw.url);
  if (!urlParse.success) return { ok: false, error: "Invalid URL" };

  const userId = await currentUserId();
  let url: URL;
  try {
    url = new URL(urlParse.data);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  const hostname = url.hostname.replace(/^www\./, "");
  const scraped = await scrapeUrl(url);

  const title = scraped?.title?.trim() || hostname;
  const vendor = scraped?.vendor ?? hostname;
  const imageUrl = scraped?.imageUrl ?? null;
  const price =
    scraped?.price === undefined || scraped.price === null
      ? null
      : Math.round(scraped.price * 100);
  const currency = scraped?.currency ?? "USD";
  const category =
    scraped?.category && (wishlistCategories as readonly string[]).includes(scraped.category)
      ? (scraped.category as (typeof wishlistCategories)[number])
      : "Other";

  const metadata = JSON.stringify({
    parser: scraped?.raw?.parser ?? "none",
    raw: scraped?.raw ?? null,
    scrapedAt: Date.now(),
  });

  try {
    const inserted = await db
      .insert(wishlistItems)
      .values({
        ownerId: userId,
        title,
        sourceUrl: url.toString(),
        vendor,
        imageUrl,
        price,
        currency,
        category,
        priority: "Medium",
        status: "Wanted",
        scrapedMetadata: metadata,
      })
      .returning();
    const row = inserted[0];
    if (!row) return { ok: false, error: "Insert returned no row" };
    revalidatePath("/wishlist");
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create item",
    };
  }
}

export async function setWishlistStatus(
  raw: z.infer<typeof statusSchema>,
): Promise<ActionResult<WishlistItem>> {
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await currentUserId();
  const { id, status } = parsed.data;

  const existing = await db
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.id, id), eq(wishlistItems.ownerId, userId)))
    .limit(1);
  if (!existing[0]) return { ok: false, error: "Item not found" };

  const patch: Partial<typeof wishlistItems.$inferInsert> = { status };
  if (status === "Wanted") patch.dateResolved = null;
  else patch.dateResolved = new Date();

  try {
    const updated = await db
      .update(wishlistItems)
      .set(patch)
      .where(eq(wishlistItems.id, id))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, error: "Update returned no row" };
    revalidatePath("/wishlist");
    revalidatePath("/projects");
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update status",
    };
  }
}
