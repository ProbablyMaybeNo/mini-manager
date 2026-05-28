import "server-only";

import type { VendorParser } from "../types";
import { parseOpenGraph, parsePrice } from "../og";

/**
 * eBay item listings. OG covers most of the basics; we also probe the
 * `notranslate` price span eBay uses as a fallback.
 */
export const ebay: VendorParser = {
  name: "ebay",
  hostnames: ["ebay.com", "ebay.co.uk", "ebay.de", "ebay.fr", "ebay.it", "ebay.es", "ebay.ca"],
  parse(html, url) {
    const og = parseOpenGraph(html, url);
    const itemPropPrice = html.match(
      /<span[^>]+itemprop="price"[^>]*content="([^"]+)"/,
    )?.[1];
    const itemPropCurrency = html.match(
      /<span[^>]+itemprop="priceCurrency"[^>]*content="([^"]+)"/,
    )?.[1];
    const price = og?.price ?? (itemPropPrice ? parsePrice(itemPropPrice) : undefined);
    return {
      title: og?.title ?? url.pathname.split("/").filter(Boolean).pop() ?? url.hostname,
      imageUrl: og?.imageUrl,
      price,
      currency: og?.currency ?? itemPropCurrency ?? defaultEbayCurrency(url.hostname),
      vendor: "eBay",
      category: og?.category,
      raw: { parser: "ebay", itemPropPrice, itemPropCurrency, ogPresent: !!og },
    };
  },
};

function defaultEbayCurrency(host: string): string {
  if (host.endsWith(".co.uk")) return "GBP";
  if (host.endsWith(".de") || host.endsWith(".fr") || host.endsWith(".it") || host.endsWith(".es"))
    return "EUR";
  if (host.endsWith(".ca")) return "CAD";
  return "USD";
}
