import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  wishlistItems,
  type WishlistItem,
  type WishlistStatus,
  type WishlistCategory,
} from "@/db/schema";

export interface WishlistFilters {
  status?: WishlistStatus | "All";
  category?: WishlistCategory | null;
  projectId?: string | null;
  vendor?: string | null;
}

export async function listWishlist(
  userId: string,
  opts: WishlistFilters = {},
): Promise<ReadonlyArray<WishlistItem>> {
  const filters = [eq(wishlistItems.ownerId, userId)];
  if (opts.status && opts.status !== "All") {
    filters.push(eq(wishlistItems.status, opts.status));
  }
  if (opts.category) {
    filters.push(eq(wishlistItems.category, opts.category));
  }
  if (opts.projectId === null) {
    filters.push(isNull(wishlistItems.projectId));
  } else if (opts.projectId) {
    filters.push(eq(wishlistItems.projectId, opts.projectId));
  }
  if (opts.vendor) {
    filters.push(eq(wishlistItems.vendor, opts.vendor));
  }
  return db
    .select()
    .from(wishlistItems)
    .where(and(...filters))
    .orderBy(desc(wishlistItems.dateAdded));
}

export async function getWishlistItem(
  userId: string,
  id: string,
): Promise<WishlistItem | null> {
  const rows = await db
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.ownerId, userId), eq(wishlistItems.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export interface WishlistTotals {
  count: number;
  totalByCurrency: Record<string, number>;
}

/**
 * Sum visible-line items per currency. Prices stored as integer cents
 * are converted to floats at the boundary (display only).
 */
export async function wishlistTotals(
  userId: string,
  status: WishlistStatus | "All" = "Wanted",
): Promise<WishlistTotals> {
  const filters = [eq(wishlistItems.ownerId, userId)];
  if (status !== "All") filters.push(eq(wishlistItems.status, status));

  const rows = await db
    .select({
      currency: wishlistItems.currency,
      total: sql<number>`COALESCE(SUM(${wishlistItems.price}), 0)`,
      n: sql<number>`COUNT(*)`,
    })
    .from(wishlistItems)
    .where(and(...filters))
    .groupBy(wishlistItems.currency);

  const totalByCurrency: Record<string, number> = {};
  let count = 0;
  for (const row of rows) {
    const code = row.currency ?? "USD";
    totalByCurrency[code] = (totalByCurrency[code] ?? 0) + Number(row.total) / 100;
    count += Number(row.n);
  }
  return { count, totalByCurrency };
}

/** Distinct vendors the user has used — for the filter combobox. */
export async function listWishlistVendors(
  userId: string,
): Promise<ReadonlyArray<string>> {
  const rows = await db
    .selectDistinct({ vendor: wishlistItems.vendor })
    .from(wishlistItems)
    .where(eq(wishlistItems.ownerId, userId))
    .orderBy(asc(wishlistItems.vendor));
  return rows.map((r) => r.vendor).filter((v): v is string => !!v);
}
