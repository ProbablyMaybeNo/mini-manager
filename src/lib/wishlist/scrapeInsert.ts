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
import type { ScrapedProduct } from "@/lib/scrape/types";
import { inferWishlistKind } from "@/lib/wishlist/kindInference";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * J1 — did the scrape actually read a product, or just fall back to the
 * page hostname? A fetch that can't reach the page (Games Workshop answers
 * 403, then an AWS WAF JavaScript challenge — R3-2) yields `null`; one that
 * reaches an unreadable page
 * yields a bare hostname title with no other signal. Either way there's
 * nothing worth persisting, so we surface an honest "couldn't auto-read"
 * state instead of a `games-workshop.com` row + a green success toast.
 *
 * A real product title (anything other than the hostname) counts as
 * usable, as does a scraped price or image even when the title is weak.
 */
function scrapeIsUsable(
  scraped: ScrapedProduct | null,
  hostname: string,
): boolean {
  if (!scraped) return false;
  const title = scraped.title?.trim() ?? "";
  const titleUsable =
    title.length > 0 && title.toLowerCase() !== hostname.toLowerCase();
  if (titleUsable) return true;
  // A hostname/blank title is still salvageable if the parser pulled a
  // real signal we can show the painter.
  if (scraped.price !== undefined && scraped.price !== null) return true;
  if (scraped.imageUrl) return true;
  return false;
}

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

  // J1 — bail honestly rather than persist a hostname-named placeholder
  // row (and fire a false "Added" toast) when the scrape read nothing
  // usable. The caller drops the painter into manual entry instead.
  if (!scrapeIsUsable(scraped, hostname)) {
    return {
      ok: false,
      error:
        "We couldn’t auto-read that page. Add the details yourself below.",
      reason: "unreadable",
    };
  }

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
