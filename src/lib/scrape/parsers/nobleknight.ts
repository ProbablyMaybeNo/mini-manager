import "server-only";

import type { ScrapedProduct, VendorParser } from "../types";
import { parsePrice } from "../og";
import { inferCategoryFromUrl } from "../util";

/**
 * Noble Knight Games (nobleknight.com). og:title is verbose with
 * trailing brand redundancy; og:image is missing but twitter:image
 * holds the product photo. Price lives in a JSON blob.
 *
 *   title  ← og:title, trimmed; OR <title> stripped of NK suffix
 *   image  ← twitter:image
 *   price  ← "price": "X.XX" (Schema.org JSON-LD)
 */
export const nobleknight: VendorParser = {
  name: "nobleknight",
  hostnames: ["nobleknight.com"],
  parse(html, url) {
    const title = extractTitle(html) ?? slugFromUrl(url);
    const imageUrl =
      pickMeta(html, "twitter:image") ?? pickMeta(html, "og:image");
    const price = extractPrice(html);

    return {
      title,
      imageUrl,
      vendor: "Noble Knight Games",
      price,
      currency: "USD",
      category: inferCategoryFromUrl(url),
      raw: {
        parser: "nobleknight",
        title,
        imageUrl,
        priceMatched: price !== undefined,
      },
    };
  },
};

const NK_SUFFIX = / \| Buy at Noble Knight Games$/i;

function extractTitle(html: string): string | undefined {
  const og = pickMeta(html, "og:title")?.trim();
  if (og && og !== "Noble Knight Games") {
    return tidy(decodeEntities(og));
  }
  const titleTag = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  if (!titleTag) return undefined;
  const cleaned = tidy(decodeEntities(titleTag).replace(NK_SUFFIX, ""));
  return cleaned || undefined;
}

/**
 * NK's og:title often duplicates the brand: "Magenta - Paint - AK-Interactive
 * from AK-Interactive". Strip the trailing " from <X>" when <X> already appears
 * earlier in the string, and squash double spaces.
 */
function tidy(s: string): string {
  let out = s.replace(/\s+/g, " ").trim();
  const m = out.match(/^(.*?)\s+from\s+([^\s].*?)$/i);
  if (m && m[1] && m[2] && m[1].toLowerCase().includes(m[2].toLowerCase())) {
    out = m[1].trim();
  }
  return out;
}

function extractPrice(html: string): number | undefined {
  const raw = html.match(/"price"\s*:\s*"([0-9.]+)"/)?.[1];
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
