import "server-only";

import type { ScrapedProduct, VendorParser } from "../types";
import { inferCategoryFromUrl } from "../util";

/**
 * Game Kastle (gamekastle.com). Shopify storefront. OG metadata is
 * clean for title + image. Shopify serialises price in cents inside
 * the product JSON: "price":525 → $5.25.
 *
 *   title  ← og:title
 *   image  ← og:image (force https via og:image:secure_url when present)
 *   price  ← Shopify "price":<cents> int → /100
 */
export const gamekastle: VendorParser = {
  name: "gamekastle",
  hostnames: ["gamekastle.com"],
  parse(html, url) {
    const title = pickMeta(html, "og:title")?.trim();
    const imageUrl =
      pickMeta(html, "og:image:secure_url") ?? pickMeta(html, "og:image");
    const price = extractPrice(html);

    return {
      title: title && title !== "Game Kastle" ? decodeEntities(title) : slugFromUrl(url),
      imageUrl,
      vendor: "Game Kastle",
      price,
      currency: "USD",
      category: inferCategoryFromUrl(url),
      raw: {
        parser: "gamekastle",
        title,
        imageUrl,
        priceMatched: price !== undefined,
      },
    };
  },
};

function extractPrice(html: string): number | undefined {
  // Shopify product JSON: "price":525 (cents). Prefer the integer form
  // because the float form ("price":"5.25") sometimes shows the compare-at
  // (list) price instead of the sale price on Game Kastle.
  const cents = html.match(/"price"\s*:\s*([0-9]{2,})\b/)?.[1];
  if (cents) {
    const n = Number(cents);
    if (Number.isFinite(n)) return n / 100;
  }
  const dollars = html.match(/"price"\s*:\s*"([0-9]+\.[0-9]{2})"/)?.[1];
  if (dollars) {
    const n = Number(dollars);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
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
