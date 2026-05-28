import "server-only";

import type { ScrapedProduct, VendorParser } from "./types";
import { parseOpenGraph } from "./og";
import { elementgames } from "./parsers/elementgames";
import { wayland } from "./parsers/wayland";
import { goblin } from "./parsers/goblin";
import { gw } from "./parsers/gw";
import { amazon } from "./parsers/amazon";
import { ebay } from "./parsers/ebay";

const PARSERS: ReadonlyArray<VendorParser> = [
  elementgames,
  wayland,
  goblin,
  gw,
  amazon,
  ebay,
];

const USER_AGENT = "Mini Manager / wishlist-scrape (https://miniaturemanager.app/bot)";
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Resolve a URL → scraped product via the vendor map; OG fallback;
 * null if even OG fails. Never throws. The action layer creates a
 * minimal row when this returns null so painters can paste in bulk
 * and edit later.
 */
export async function scrapeUrl(url: URL): Promise<ScrapedProduct | null> {
  const html = await safeFetchHtml(url);
  if (!html) return null;

  const hostname = url.hostname.replace(/^www\./, "");
  const vendor = PARSERS.find((p) =>
    p.hostnames.some((h) => hostname === h || hostname.endsWith(`.${h}`)),
  );
  if (vendor) {
    try {
      return vendor.parse(html, url);
    } catch {
      // Vendor parser exploded — fall through to OG.
    }
  }
  return parseOpenGraph(html, url);
}

async function safeFetchHtml(url: URL): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
