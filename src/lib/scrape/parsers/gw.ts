import "server-only";

import type { ScrapedProduct, VendorParser } from "../types";
import { parseOpenGraph } from "../og";
import { gwCurrencyForHost } from "../util";

export const gw: VendorParser = {
  name: "gw",
  hostnames: ["games-workshop.com"],
  parse(html, url) {
    const og: ScrapedProduct =
      parseOpenGraph(html, url) ?? { title: url.hostname, vendor: url.hostname, raw: {} };
    return {
      ...og,
      vendor: "Games Workshop",
      currency: og.currency ?? gwCurrencyForHost(url.hostname),
      raw: { ...og.raw, parser: "gw" },
    };
  },
};
