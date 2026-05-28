import "server-only";

/**
 * Common shape returned by every vendor parser + the OG fallback.
 * The dispatcher wraps it and an action stores it in WishlistItem.
 */
export interface ScrapedProduct {
  title: string;
  imageUrl?: string | undefined;
  price?: number | undefined; // dollars (or whichever currency); not cents
  currency?: string | undefined;
  vendor: string;
  category?: ScrapedCategory | undefined;
  /** Trimmed JSON blob persisted in WishlistItem.scrapedMetadata so we can
   *  see which parser fired and what it pulled. NEVER includes raw HTML. */
  raw: Record<string, unknown>;
}

export type ScrapedCategory =
  | "Box"
  | "Bits"
  | "Paint"
  | "Tool"
  | "Terrain"
  | "Other";

/**
 * Vendor-parser contract. Each parser exports an object with the
 * hostnames it handles + a `parse(html, url)` function. The dispatcher
 * matches by hostname suffix so subdomains (e.g. `us.games-workshop.com`)
 * route to the same parser as `games-workshop.com`.
 */
export interface VendorParser {
  name: string;
  hostnames: string[];
  parse(html: string, url: URL): ScrapedProduct;
}
