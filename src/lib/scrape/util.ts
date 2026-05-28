import "server-only";

import type { ScrapedCategory } from "./types";

/**
 * Cheap URL-path → category guess. Used by all parsers as a fallback
 * when the page itself doesn't expose breadcrumbs.
 */
export function inferCategoryFromUrl(url: URL): ScrapedCategory | undefined {
  const path = url.pathname.toLowerCase();
  if (/paint|wash|primer|varnish|contrast/.test(path)) return "Paint";
  if (/brush|tool|file|clipper/.test(path)) return "Tool";
  if (/terrain|scenery|battlefield/.test(path)) return "Terrain";
  if (/bits|conversion|kitbash/.test(path)) return "Bits";
  if (/box|kit|set|collection|patrol|combat/.test(path)) return "Box";
  return undefined;
}

/** Currency by Amazon TLD. */
export function amazonCurrencyForHost(host: string): string {
  if (host.endsWith(".co.uk")) return "GBP";
  if (host.endsWith(".de")) return "EUR";
  if (host.endsWith(".fr")) return "EUR";
  if (host.endsWith(".it")) return "EUR";
  if (host.endsWith(".es")) return "EUR";
  if (host.endsWith(".ca")) return "CAD";
  if (host.endsWith(".com.au")) return "AUD";
  if (host.endsWith(".co.jp")) return "JPY";
  return "USD";
}

/** Games Workshop subdomain → currency. */
export function gwCurrencyForHost(host: string): string {
  if (host.startsWith("uk.")) return "GBP";
  if (host.startsWith("eu.")) return "EUR";
  if (host.startsWith("de.")) return "EUR";
  if (host.startsWith("fr.")) return "EUR";
  if (host.startsWith("es.")) return "EUR";
  if (host.startsWith("au.")) return "AUD";
  if (host.startsWith("jp.")) return "JPY";
  return "USD";
}
