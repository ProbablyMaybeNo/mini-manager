import "server-only";

import type { ScrapedProduct, VendorParser } from "../types";
import { parsePrice } from "../og";
import { inferCategoryFromUrl } from "../util";

/**
 * Gamers Roll (gamersroll.com). Magento-style. og:price:amount is
 * populated cleanly, but og:title is missing, so we fall back to the
 * <title> tag and strip the site suffix.
 *
 *   title  ← <title>, stripped of " at Gamersroll"
 *   image  ← og:image
 *   price  ← og:price:amount (then "price":X.XX in body)
 */
export const gamersroll: VendorParser = {
  name: "gamersroll",
  hostnames: ["gamersroll.com"],
  parse(html, url) {
    const title = extractTitle(html) ?? slugFromUrl(url);
    const imageUrl = pickMeta(html, "og:image");
    const price = extractPrice(html);
    const currencyMeta =
      pickMeta(html, "og:price:currency") ??
      pickMeta(html, "product:price:currency");

    return {
      title,
      imageUrl,
      vendor: "Gamers Roll",
      price,
      currency: currencyMeta?.toUpperCase() ?? "USD",
      category: inferCategoryFromUrl(url),
      raw: {
        parser: "gamersroll",
        title,
        imageUrl,
        priceMatched: price !== undefined,
      },
    };
  },
};

const GR_SUFFIX = / at Gamersroll$/i;

function extractTitle(html: string): string | undefined {
  const og = pickMeta(html, "og:title")?.trim();
  if (og && og !== "Gamersroll") return decodeEntities(og);
  const titleTag = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  if (!titleTag) return undefined;
  const cleaned = decodeEntities(titleTag).replace(GR_SUFFIX, "").trim();
  return cleaned || undefined;
}

function extractPrice(html: string): number | undefined {
  const og =
    pickMeta(html, "og:price:amount") ?? pickMeta(html, "product:price:amount");
  if (og) return parsePrice(og);
  const body = html.match(/"price"\s*:\s*([0-9]+\.[0-9]+)/)?.[1];
  if (body) return parsePrice(body);
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
