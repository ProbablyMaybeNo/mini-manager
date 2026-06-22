import type { NextResponse } from "next/server";
import { z } from "zod";
import { verifyExtensionToken } from "@/lib/auth/extensionToken";
import { isSupportedStoreUrl } from "@/lib/scrape/stores";
import { scrapeAndInsertWishlistItem } from "@/lib/wishlist/scrapeInsert";
import { isProUser } from "@/lib/billing/enforce";
import { bearerToken, corsJson, preflight } from "../_cors";

/**
 * POST /api/extension/add
 *
 * Body: { url: string, status: "OWNED" | "WISHLIST", projectId?: string }
 * Auth: `Authorization: Bearer <extension-token>`
 *
 * Re-scrapes the URL SERVER-SIDE (the client never sends product fields,
 * so it can't forge name/price/vendor) and inserts a collection item for
 * the authenticated user via the shared `scrapeAndInsertWishlistItem`
 * pipeline — the SAME write path the in-app URL quick-add uses.
 */

const bodySchema = z.object({
  url: z.string().url("A valid URL is required"),
  // The extension toggle only offers Owned / Wishlist; the full status
  // lifecycle is edited later in the app.
  status: z.enum(["OWNED", "WISHLIST"]),
  projectId: z.string().min(1).max(64).optional(),
});

export function OPTIONS(req: Request): NextResponse {
  return preflight(req);
}

export async function POST(req: Request): Promise<NextResponse> {
  const token = bearerToken(req);
  const userId = token ? await verifyExtensionToken(token) : null;
  if (!userId) {
    return corsJson(req, { error: "Invalid or missing extension token" }, 401);
  }

  // The browser extension is a Pro feature (free users add via the website's
  // URL paste). Inactive until BILLING_ENFORCED flips on at launch, so the
  // extension stays testable for everyone until then.
  if (!(await isProUser(userId))) {
    return corsJson(
      req,
      {
        error:
          "The browser extension is a Pro feature — upgrade to add items straight from a store page.",
        upgradeUrl: "/pricing",
      },
      402,
    );
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

  const { url: rawUrl, status, projectId } = parsed.data;
  if (!isSupportedStoreUrl(rawUrl)) {
    return corsJson(
      req,
      { error: "This store isn’t supported yet", supported: false },
      422,
    );
  }

  const result = await scrapeAndInsertWishlistItem({
    userId,
    url: new URL(rawUrl),
    status,
    projectId: projectId ?? null,
  });

  if (!result.ok) {
    // Free-tier cap rejections carry an upgradeUrl; surface 402 so the
    // popup can show a clear "limit reached" message, else a generic 422.
    const isLimit = "upgradeUrl" in result;
    return corsJson(
      req,
      { error: result.error, upgradeUrl: isLimit ? result.upgradeUrl : undefined },
      isLimit ? 402 : 422,
    );
  }

  const item = result.data;
  return corsJson(req, {
    item: {
      id: item.id,
      title: item.title,
      status: item.status,
      kind: item.kind,
      vendor: item.vendor,
      price: item.price,
      currency: item.currency,
      imageUrl: item.imageUrl,
      sourceUrl: item.sourceUrl,
    },
  });
}
