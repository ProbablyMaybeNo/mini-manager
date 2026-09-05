import type { NextResponse } from "next/server";
import { z } from "zod";
import { verifyExtensionToken } from "@/lib/auth/extensionToken";
import { isSupportedStoreUrl, matchSupportedStore } from "@/lib/scrape/stores";
import { scrapeUrl } from "@/lib/scrape";
import { inferWishlistKind } from "@/lib/wishlist/kindInference";
import { bearerToken, corsJson, preflight } from "../_cors";

/**
 * POST /api/extension/preview
 *
 * Body: { url: string }
 * Auth: `Authorization: Bearer <extension-token>`
 *
 * Scrapes a SUPPORTED store's product page and returns the parsed
 * product so the extension popup can render a preview card BEFORE the
 * user commits to adding it. Returns 422 when the URL isn't a supported
 * store, or when the scrape finds nothing usable.
 */

const bodySchema = z.object({ url: z.string().url("A valid URL is required") });

export function OPTIONS(req: Request): NextResponse {
  return preflight(req);
}

export async function POST(req: Request): Promise<NextResponse> {
  const token = bearerToken(req);
  const userId = token ? await verifyExtensionToken(token) : null;
  if (!userId) {
    return corsJson(req, { error: "Invalid or missing extension token" }, 401);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return corsJson(req, { error: "Body must be valid JSON" }, 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return corsJson(
      req,
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      400,
    );
  }

  const { url: rawUrl } = parsed.data;
  if (!isSupportedStoreUrl(rawUrl)) {
    return corsJson(
      req,
      { error: "This store isn’t supported yet", supported: false },
      422,
    );
  }

  const store = matchSupportedStore(rawUrl);
  const scraped = await scrapeUrl(new URL(rawUrl));
  if (!scraped) {
    return corsJson(
      req,
      { error: "Couldn’t read a product from that page", supported: true },
      422,
    );
  }

  // Advisory only. The popup preselects its Paint/Model toggle from this and
  // the painter can override it, so a wrong guess costs one tap instead of
  // filing the row in the wrong collection. Same helper the server falls back
  // to when an older extension sends no kind at all.
  const suggestedKind = inferWishlistKind({
    title: scraped.title,
    vendor: scraped.vendor,
    category: scraped.category ?? null,
  });

  // Shape the popup card needs — never the raw HTML / parser blob.
  return corsJson(req, {
    suggestedKind,
    product: {
      name: scraped.title,
      price: scraped.price ?? null,
      currency: scraped.currency ?? "USD",
      vendor: scraped.vendor,
      image: scraped.imageUrl ?? null,
      category: scraped.category ?? null,
    },
    store: store?.name ?? scraped.vendor,
    url: rawUrl,
  });
}
