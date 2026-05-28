import "server-only";

import type { ScrapedProduct, VendorParser } from "../types";
import { parsePrice } from "../og";
import { inferCategoryFromUrl } from "../util";

/**
 * Miniature Market (miniaturemarket.com). Magento store, OG is good
 * for title + image; price lives inline as a JSON literal.
 *
 *   title  ← og:title, stripped of " | ... | Miniature Market"
 *   image  ← og:image
 *   price  ← "price":X.XX (first occurrence — Magento dataLayer)
 *   brand  ← product:brand (informational; we stash it in raw)
 */
export const miniaturemarket: VendorParser = {
  name: "miniaturemarket",
  hostnames: ["miniaturemarket.com"],
  parse(html, url) {
    const title = extractTitle(html) ?? slugFromUrl(url);
    const imageUrl = pickMeta(html, "og:image");
    const price = extractPrice(html);
    const brand = pickMeta(html, "product:brand");

    return {
      title,
      imageUrl,
      vendor: "Miniature Market",
      price,
      currency: "USD",
      category: inferCategoryFromUrl(url),
      raw: {
        parser: "miniaturemarket",
        title,
        imageUrl,
        priceMatched: price !== undefined,
        brand,
      },
    };
  },
};

const MM_SUFFIX_RE = /\s*\|\s*[^|]+\s*\|\s*Miniature Market$/i;

function extractTitle(html: string): string | undefined {
  const og = pickMeta(html, "og:title");
  if (!og) return undefined;
  const cleaned = decodeEntities(og).replace(MM_SUFFIX_RE, "").trim();
  if (!cleaned || cleaned === "Miniature Market") return undefined;
  return cleaned;
}

function extractPrice(html: string): number | undefined {
  // Magento serialises the price as a float literal in dataLayer JSON.
  // First occurrence is the configured product price (subsequent ones
  // are repeats / variants).
  const raw = html.match(/"price"\s*:\s*([0-9]+\.[0-9]+)/)?.[1];
  if (!raw) return undefined;
  return parsePrice(raw);
}

function pickMeta(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
    "i",
  );
  return html.match(re1)?.[1] ?? html.match(re2)?.[1];
}

function slugFromUrl(url: URL): string {
  return url.pathname.split("/").filter(Boolean).pop() ?? url.hostname;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}
