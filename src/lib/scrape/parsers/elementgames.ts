import "server-only";

import type { ScrapedProduct, VendorParser } from "../types";
import { parseOpenGraph } from "../og";

/**
 * Element Games (elementgames.co.uk). Mostly OG-friendly; we just
 * fix the vendor label and force GBP since their OG sometimes omits
 * the currency.
 */
export const elementgames: VendorParser = {
  name: "elementgames",
  hostnames: ["elementgames.co.uk"],
  parse(html, url) {
    const og = parseOpenGraph(html, url);
    const base: ScrapedProduct = og ?? minimalFromUrl(url);
    return {
      ...base,
      vendor: "Element Games",
      currency: base.currency ?? "GBP",
      raw: { ...base.raw, parser: "elementgames" },
    };
  },
};

function minimalFromUrl(url: URL): ScrapedProduct {
  return {
    title: url.pathname.split("/").filter(Boolean).pop() ?? url.hostname,
    vendor: url.hostname,
    raw: {},
  };
}
