import "server-only";

import type { VendorParser } from "../types";
import { parseOpenGraph, parsePrice } from "../og";
import { amazonCurrencyForHost } from "../util";

/**
 * Amazon is aggressive about anti-bot — the live product page often
 * returns a CAPTCHA or "Robot Check" interstitial. We try OG first
 * (which still works for many product pages) then fall back to the
 * priceblock_ourprice / priceblock_dealprice / a-offscreen patterns.
 *
 * If everything fails we return a minimal entry — the painter can
 * edit the row in the drawer.
 */
export const amazon: VendorParser = {
  name: "amazon",
  hostnames: [
    "amazon.com",
    "amazon.co.uk",
    "amazon.de",
    "amazon.fr",
    "amazon.it",
    "amazon.es",
    "amazon.ca",
    "amazon.com.au",
    "amazon.co.jp",
  ],
  parse(html, url) {
    const og = parseOpenGraph(html, url);
    const priceMatch =
      html.match(
        /<span[^>]+class="[^"]*\b(?:a-offscreen|priceblock_ourprice|priceblock_dealprice)\b[^"]*"[^>]*>([^<]+)<\/span>/,
      )?.[1] ?? null;
    const price = og?.price ?? (priceMatch ? parsePrice(priceMatch) : undefined);
    const titleMatch = og?.title ?? html.match(/<span[^>]+id="productTitle"[^>]*>([^<]+)<\/span>/)?.[1]?.trim();
    return {
      title: (titleMatch ?? url.hostname).trim(),
      imageUrl: og?.imageUrl,
      price,
      currency: og?.currency ?? amazonCurrencyForHost(url.hostname),
      vendor: "Amazon",
      category: og?.category,
      raw: { parser: "amazon", priceMatch, ogPresent: !!og },
    };
  },
};
