"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  wishlistItems,
  wishlistCategories,
  wishlistKinds,
  wishlistStatuses,
  collectionPaintTypes,
  priorities,
  type WishlistItem,
} from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";
import { enforceCreateLimit } from "@/lib/billing/enforce";
import { inferWishlistKind } from "@/lib/wishlist/kindInference";
import { scrapeAndInsertWishlistItem } from "@/lib/wishlist/scrapeInsert";

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
  // COLLECTIONS rebuild — new structured fields.
  company: z.string().trim().max(120).nullish(),
  paintType: z.enum(collectionPaintTypes).nullish(),
  game: z.string().trim().max(120).nullish(),
  army: z.string().trim().max(120).nullish(),
  kind: z.enum(wishlistKinds).optional(),
  status: z.enum(wishlistStatuses).optional(),
  priority: z.enum(priorities).optional(),
  projectId: z.string().min(1).max(64).nullish(),
  recipeId: z.string().min(1).max(64).nullish(),
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

const kindSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(wishlistKinds),
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

  // P10.2 — Free-tier wishlist cap (3 items). Counts the whole wishlist
  // regardless of `kind` (paint vs model) or `status` (the row exists
  // either way — moving to PURCHASED doesn't free a slot).
  const ownedRows = await db
    .select({ n: count() })
    .from(wishlistItems)
    .where(eq(wishlistItems.ownerId, userId));
  const wishlistGate = await enforceCreateLimit(
    userId,
    "wishlist",
    ownedRows[0]?.n ?? 0,
  );
  if (wishlistGate) return wishlistGate;

  try {
    const inserted = await db
      .insert(wishlistItems)
      .values({
        ownerId: userId,
        title: d.title,
        imageUrl: d.imageUrl ?? null,
        sourceUrl: d.sourceUrl ?? null,
        vendor: d.vendor ?? null,
        company: d.company ?? null,
        paintType: d.paintType ?? null,
        game: d.game ?? null,
        army: d.army ?? null,
        price: priceToCents(d.price ?? null),
        currency: d.currency ?? "USD",
        category: d.category ?? "Other",
        priority: d.priority ?? "Medium",
        status: d.status ?? "WISHLIST",
        // COLLECTIONS — an explicit kind (the painter chose Paint vs Model
        // when adding) wins; otherwise fall back to the title/vendor
        // heuristic so URL/manual quick-adds still auto-sort.
        kind:
          d.kind ??
          inferWishlistKind({
            title: d.title,
            vendor: d.vendor ?? null,
            category: d.category ?? null,
          }),
        projectId: d.projectId ?? null,
        notesMd: d.notesMd ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) return { ok: false, error: "Insert returned no row" };
    revalidatePath("/collection");
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
  if (patch.company !== undefined) patchValues.company = patch.company ?? null;
  if (patch.paintType !== undefined) patchValues.paintType = patch.paintType ?? null;
  if (patch.game !== undefined) patchValues.game = patch.game ?? null;
  if (patch.army !== undefined) patchValues.army = patch.army ?? null;
  if (patch.kind !== undefined) patchValues.kind = patch.kind;
  if (patch.status !== undefined) patchValues.status = patch.status;
  if (patch.priority !== undefined) patchValues.priority = patch.priority;
  if (patch.projectId !== undefined) patchValues.projectId = patch.projectId ?? null;
  if (patch.recipeId !== undefined) patchValues.recipeId = patch.recipeId ?? null;
  if (patch.notesMd !== undefined) patchValues.notesMd = patch.notesMd ?? null;

  try {
    const updated = await db
      .update(wishlistItems)
      .set(patchValues)
      .where(eq(wishlistItems.id, id))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, error: "Update returned no row" };
    revalidatePath("/collection");
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
    revalidatePath("/collection");
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
  raw: { url: string; kind?: (typeof wishlistKinds)[number] },
): Promise<ActionResult<WishlistItem>> {
  const urlParse = z
    .string()
    .url()
    .safeParse(raw.url);
  if (!urlParse.success) return { ok: false, error: "Invalid URL" };

  // MM-36 — honour the Paint/Model toggle the painter selected. When
  // provided, the explicit kind wins over the title/vendor heuristic so
  // a model URL never lands in the paint table (and vice-versa).
  const kindParse = z.enum(wishlistKinds).optional().safeParse(raw.kind);
  if (!kindParse.success) return { ok: false, error: "Invalid item type" };
  const selectedKind = kindParse.data;

  const userId = await currentUserId();
  let url: URL;
  try {
    url = new URL(urlParse.data);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  // Delegate to the shared scrape+insert pipeline (also used by the
  // browser-extension API route) so there's one write path. It applies
  // the free-tier cap, server-side scrape, and the same validation.
  const result = await scrapeAndInsertWishlistItem({
    userId,
    url,
    status: "WISHLIST",
    kind: selectedKind,
  });
  if (result.ok) revalidatePath("/collection");
  return result;
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
  if (status === "WISHLIST") patch.dateResolved = null;
  else patch.dateResolved = new Date();

  try {
    const updated = await db
      .update(wishlistItems)
      .set(patch)
      .where(eq(wishlistItems.id, id))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, error: "Update returned no row" };
    revalidatePath("/collection");
    revalidatePath("/projects");
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update status",
    };
  }
}

/**
 * P12.12 — flip a wishlist row between 'paint' and 'model'. Used by
 * the two-table /wishlist layout when the painter realises an
 * automatic kind inference was wrong.
 */
export async function setWishlistKind(
  raw: z.infer<typeof kindSchema>,
): Promise<ActionResult<WishlistItem>> {
  const parsed = kindSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const userId = await currentUserId();
  const { id, kind } = parsed.data;

  const existing = await db
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.id, id), eq(wishlistItems.ownerId, userId)))
    .limit(1);
  if (!existing[0]) return { ok: false, error: "Item not found" };

  try {
    const updated = await db
      .update(wishlistItems)
      .set({ kind })
      .where(eq(wishlistItems.id, id))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, error: "Update returned no row" };
    revalidatePath("/collection");
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update kind",
    };
  }
}
