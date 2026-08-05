import "server-only";

import type { ScrapedProduct, VendorParser } from "./types";
import { parseOpenGraph } from "./og";
import { elementgames } from "./parsers/elementgames";
import { wayland } from "./parsers/wayland";
import { nobleknight } from "./parsers/nobleknight";
import { miniaturemarket } from "./parsers/miniaturemarket";
import { gamersroll } from "./parsers/gamersroll";

/**
 * R3-2 — mirrors `./stores`. The `gw`, `goblin` and `gamekastle` parsers are
 * deliberately NOT registered: those hosts refuse a datacentre-IP fetch (AWS
 * WAF challenge / 429), so `safeFetchHtml` returns null and the parser can
 * never run. `amazon` and `ebay` are unregistered too (Ross, 2026-08-05).
 * Their modules are kept for the day any of this changes; re-adding one here
 * and to `SUPPORTED_STORES` is all it takes.
 */
const PARSERS: ReadonlyArray<VendorParser> = [
  elementgames,
  wayland,
  nobleknight,
  miniaturemarket,
  gamersroll,
];

const USER_AGENT = "Mini Mainframe / wishlist-scrape (https://mini-mainframe.com/bot)";
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
