import "server-only";

import type { ScrapedProduct, VendorParser } from "../types";
import { parsePrice } from "../og";
import { inferCategoryFromUrl } from "../util";

/**
 * Element Games (elementgames.co.uk). Their OpenGraph metadata is
 * useless site-wide — `og:title` returns "Element Games" and `og:image`
 * is an unsubstituted template path. We parse the real page instead.
 *
 *   title  ← <title>{name} | Element Games</title>, strip the suffix
 *   image  ← first src="...images/products/{id}/{id}-large.jpg"
 *   price  ← <span class="currentPrice">&pound;X.XX</span>
 */
export const elementgames: VendorParser = {
  name: "elementgames",
  hostnames: ["elementgames.co.uk"],
  parse(html, url) {
    const title = extractTitle(html) ?? slugFromUrl(url);
    const imageUrl = extractProductImage(html);
    const price = extractPrice(html);

    return {
      title,
      imageUrl,
      vendor: "Element Games",
      price,
      currency: "GBP",
      category: inferCategoryFromUrl(url),
      raw: {
        parser: "elementgames",
        title,
        imageUrl,
        priceMatched: price !== undefined,
      },
    };
  },
};

const TITLE_SUFFIX = / \| Element Games$/i;

function extractTitle(html: string): string | undefined {
  const raw = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  if (!raw) return undefined;
  const cleaned = decodeEntities(raw.trim()).replace(TITLE_SUFFIX, "").trim();
  if (!cleaned || cleaned === "Element Games") return undefined;
  return cleaned;
}

/**
 * EG product images live at /images/products/{id}/{id}-large.jpg with
 * a numeric id. The broken OG template has `/images/products//-small.jpg`
 * (no id) — we explicitly skip that shape.
 */
function extractProductImage(html: string): string | undefined {
  const re = /src=["'](https?:\/\/[^"']*\/images\/products\/(\d+)\/[^"']+\.(?:jpg|jpeg|png|webp))["']/i;
  return html.match(re)?.[1];
}

function extractPrice(html: string): number | undefined {
  const raw = html.match(/<span[^>]*class=["'][^"']*currentPrice[^"']*["'][^>]*>([^<]+)<\/span>/i)?.[1];
  if (!raw) return undefined;
  return parsePrice(decodeEntities(raw));
}

function slugFromUrl(url: URL): string {
  return url.pathname.split("/").filter(Boolean).pop() ?? url.hostname;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&pound;/g, "£")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}
