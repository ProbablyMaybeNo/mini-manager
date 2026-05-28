import "server-only";

import type { ScrapedProduct, VendorParser } from "../types";
import { parseOpenGraph } from "../og";

export const goblin: VendorParser = {
  name: "goblin",
  hostnames: ["goblingaming.co.uk"],
  parse(html, url) {
    const og: ScrapedProduct =
      parseOpenGraph(html, url) ?? { title: url.hostname, vendor: url.hostname, raw: {} };
    return {
      ...og,
      vendor: "Goblin Gaming",
      currency: og.currency ?? "GBP",
      raw: { ...og.raw, parser: "goblin" },
    };
  },
};
