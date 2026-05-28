import "server-only";

import type { ScrapedProduct } from "./types";
import { inferCategoryFromUrl } from "./util";

/**
 * OpenGraph fallback parser. Pulls `og:title` / `og:image` /
 * `og:price:amount` / `og:price:currency` from raw HTML via regex —
 * no DOM dependency needed for our handful of meta tags.
 *
 * Returns null if there's no usable title at all; the action layer
 * still creates a minimal row when this happens.
 */
export function parseOpenGraph(html: string, url: URL): ScrapedProduct | null {
  const title = pickMeta(html, "og:title") ?? pickTitleTag(html);
  if (!title) return null;
  const imageUrl = pickMeta(html, "og:image");
  const priceRaw = pickMeta(html, "og:price:amount") ?? pickMeta(html, "product:price:amount");
  const currency =
    pickMeta(html, "og:price:currency") ??
    pickMeta(html, "product:price:currency") ??
    undefined;
  const price = priceRaw ? parsePrice(priceRaw) : undefined;
  const hostname = url.hostname.replace(/^www\./, "");

  return {
    title: title.trim(),
    imageUrl: imageUrl ?? undefined,
    price,
    currency: currency?.toUpperCase(),
    vendor: hostname,
    category: inferCategoryFromUrl(url),
    raw: { parser: "og-fallback", title, imageUrl, priceRaw, currency },
  };
}

function pickMeta(html: string, property: string): string | undefined {
  // Look for <meta property="og:title" content="..."> in either attribute order.
  const re1 = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeReg(property)}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeReg(property)}["']`,
    "i",
  );
  return html.match(re1)?.[1] ?? html.match(re2)?.[1];
}

function pickTitleTag(html: string): string | undefined {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m?.[1]?.trim();
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parsePrice(raw: string): number | undefined {
  // Strip currency symbols, locale separators, and surrounding whitespace.
  const cleaned = raw.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return undefined;
  // If a comma appears before the last dot, treat the comma as a thousands
  // separator. If only commas → treat the last as the decimal separator.
  let normalised = cleaned;
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  if (lastComma > lastDot) {
    normalised = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalised = cleaned.replace(/,/g, "");
  }
  const n = Number(normalised);
  return Number.isFinite(n) ? n : undefined;
}
