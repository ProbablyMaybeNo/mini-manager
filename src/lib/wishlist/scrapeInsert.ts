import "server-only";

import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  wishlistItems,
  wishlistCategories,
  wishlistKinds,
  wishlistStatuses,
  type WishlistItem,
} from "@/db/schema";
import { enforceCreateLimit } from "@/lib/billing/enforce";
import { scrapeUrl } from "@/lib/scrape";
import { inferWishlistKind } from "@/lib/wishlist/kindInference";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Shared "scrape a vendor URL → insert a collection (wishlist) row"
 * pipeline, parameterised by an explicit `userId`.
 *
 * This is the SINGLE write path for URL-sourced collection items. The
 * `scrapeAndCreateWishlistItem` server action (session-authenticated UI)
 * and the extension's `POST /api/extension/add` route (token-
 * authenticated) both call this, so neither hand-rolls a parallel insert
 * and the same scrape + free-tier gate + validation applies to both.
 *
 * Server-side scrape is intentional: the caller passes only the URL +
 * status, never the product fields, so a client (the browser extension)
 * can't forge a row's name/price/vendor.
 */
export async function scrapeAndInsertWishlistItem(params: {
  userId: string;
  url: URL;
  status?: (typeof wishlistStatuses)[number];
  kind?: (typeof wishlistKinds)[number];
  projectId?: string | null;
}): Promise<ActionResult<WishlistItem>> {
  const { userId, url } = params;
  const status = params.status ?? "WISHLIST";
  const projectId = params.projectId ?? null;

  // Free-tier cap — gate BEFORE the scrape so a capped user doesn't pay
  // the 2–5s scrape latency just to be rejected at the insert step.
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
    scraped?.category &&
    (wishlistCategories as readonly string[]).includes(scraped.category)
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
        status,
        kind: params.kind ?? inferWishlistKind({ title, vendor, category }),
        projectId,
        scrapedMetadata: metadata,
        // OWNED items are resolved the moment they're added (they're not
        // waiting in the wishlist), matching setWishlistStatus's behaviour.
        dateResolved: status === "WISHLIST" ? null : new Date(),
      })
      .returning();
    const row = inserted[0];
    if (!row) return { ok: false, error: "Insert returned no row" };
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create item",
    };
  }
}
