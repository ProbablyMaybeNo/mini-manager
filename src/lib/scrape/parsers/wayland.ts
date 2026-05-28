import "server-only";

import type { ScrapedProduct, VendorParser } from "../types";
import { parseOpenGraph } from "../og";

export const wayland: VendorParser = {
  name: "wayland",
  hostnames: ["waylandgames.co.uk"],
  parse(html, url) {
    const og: ScrapedProduct =
      parseOpenGraph(html, url) ?? { title: url.hostname, vendor: url.hostname, raw: {} };
    return {
      ...og,
      vendor: "Wayland Games",
      currency: og.currency ?? "GBP",
      raw: { ...og.raw, parser: "wayland" },
    };
  },
};
