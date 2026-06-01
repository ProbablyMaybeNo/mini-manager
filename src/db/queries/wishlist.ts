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
  status: WishlistStatus | "All" = "WISHLIST",
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

/**
 * Wanted items tagged to a specific project — used by the
 * "Shopping for this" panel in the project workspace.
 */
export async function listWishlistByProject(
  userId: string,
  projectId: string,
): Promise<ReadonlyArray<WishlistItem>> {
  return db
    .select()
    .from(wishlistItems)
    .where(
      and(
        eq(wishlistItems.ownerId, userId),
        eq(wishlistItems.projectId, projectId),
        eq(wishlistItems.status, "WISHLIST"),
      ),
    )
    .orderBy(desc(wishlistItems.dateAdded));
}

/**
 * Top N wanted items globally — for the dashboard panel. Sort key:
 * priority (Urgent > Low) then date_added desc. We can't ORDER BY
 * priority directly because SQLite doesn't know the enum ordering, so
 * we do an in-memory rerank on a small slice instead.
 */
export async function listTopWishes(
  userId: string,
  limit = 5,
): Promise<ReadonlyArray<WishlistItem>> {
  const rows = await db
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.ownerId, userId), eq(wishlistItems.status, "WISHLIST")))
    .orderBy(desc(wishlistItems.dateAdded))
    .limit(limit * 4); // small overscan so rerank still has options

  const ORDER: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
  return rows
    .slice()
    .sort((a, b) => {
      const pa = ORDER[a.priority] ?? 99;
      const pb = ORDER[b.priority] ?? 99;
      if (pa !== pb) return pa - pb;
      return b.dateAdded.getTime() - a.dateAdded.getTime();
    })
    .slice(0, limit);
}

/**
 * Items bought in the last `windowDays` days — for the "Recently
 * bought" footer line on /projects (P2.8 uses this).
 */
export async function recentlyBought(
  userId: string,
  windowDays = 7,
): Promise<{ count: number; totalByCurrency: Record<string, number> }> {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      currency: wishlistItems.currency,
      price: wishlistItems.price,
    })
    .from(wishlistItems)
    .where(
      and(
        eq(wishlistItems.ownerId, userId),
        eq(wishlistItems.status, "PURCHASED"),
        sql`${wishlistItems.dateResolved} >= ${cutoff.getTime()}`,
      ),
    );

  const totalByCurrency: Record<string, number> = {};
  for (const r of rows) {
    if (r.price === null) continue;
    const code = r.currency ?? "USD";
    totalByCurrency[code] = (totalByCurrency[code] ?? 0) + r.price / 100;
  }
  return { count: rows.length, totalByCurrency };
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
