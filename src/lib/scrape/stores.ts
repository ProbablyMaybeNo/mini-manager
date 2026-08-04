/**
 * Supported-store registry — the single source of truth for which
 * vendor domains the scrape pipeline can auto-populate from.
 *
 * This module is deliberately framework-neutral (no `server-only`) so
 * the collection UI can import it to (a) render the "these stores
 * auto-fill" helper text and (b) flag a pasted URL whose host isn't
 * supported (MM-40). The server-side parsers in `./parsers` reference
 * the same hostnames so the two never drift.
 */

export interface SupportedStore {
  /** Display name shown in the helper text / vendor column. */
  name: string;
  /** Registrable hostnames this store covers (matched by suffix). */
  hostnames: string[];
}

/**
 * R3-2 — this list is a PROMISE, so it only carries hosts that answer a
 * plain server-side fetch from our datacentre IP. Three were removed after
 * live checks:
 *
 *   games-workshop.com  403, then a 202 AWS WAF JavaScript challenge
 *                       (`awsWafCookieDomainList`, `gokuProps`) once a
 *                       browser UA is sent. `fetch` can never satisfy it, and
 *                       passing it would mean driving a headless browser
 *                       purely to defeat an access control GW deployed on
 *                       purpose. Not something we do.
 *   goblingaming.co.uk  429 immediately.
 *   gamekastle.com      429 immediately.
 *
 * Delisting them is not a capability loss — the fetch already failed, so the
 * only thing that changes is that we stop advertising a store we cannot read.
 * A pasted URL from any of them still adds a row via the couldn't-auto-read
 * path (R2-4), which is what actually happened before, minus the false
 * promise. Their parsers are also unregistered in `./index`.
 */
export const SUPPORTED_STORES: ReadonlyArray<SupportedStore> = [
  { name: "Element Games", hostnames: ["elementgames.co.uk"] },
  { name: "Wayland Games", hostnames: ["waylandgames.co.uk"] },
  { name: "Noble Knight Games", hostnames: ["nobleknight.com"] },
  { name: "Miniature Market", hostnames: ["miniaturemarket.com"] },
  { name: "Gamers Roll", hostnames: ["gamersroll.com"] },
  {
    name: "Amazon",
    hostnames: [
      "amazon.com",
      "amazon.co.uk",
      "amazon.de",
      "amazon.fr",
      "amazon.it",
      "amazon.es",
      "amazon.ca",
      "amazon.com.au",
      "amazon.co.jp",
    ],
  },
  {
    name: "eBay",
    hostnames: [
      "ebay.com",
      "ebay.co.uk",
      "ebay.de",
      "ebay.fr",
      "ebay.it",
      "ebay.es",
      "ebay.ca",
    ],
  },
];

/** Display names of every supported store, in helper-text order. */
export const SUPPORTED_STORE_NAMES: ReadonlyArray<string> =
  SUPPORTED_STORES.map((s) => s.name);

/**
 * Store name + homepage URL pairs (derived from each store's primary
 * hostname), in helper-text order. Lets the collection UI render the
 * supported-stores list as clickable links without duplicating hostname
 * logic (Ross — click-through to the store's site).
 */
export const SUPPORTED_STORE_LINKS: ReadonlyArray<{ name: string; url: string }> =
  SUPPORTED_STORES.map((s) => ({ name: s.name, url: `https://${s.hostnames[0]}` }));

/** Normalise a hostname: lowercase + strip a leading `www.`. */
function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/**
 * Resolve a pasted URL to its supported store, or `null` when no parser
 * covers it. Matches by exact host or registrable-suffix so subdomains
 * (e.g. `shop.elementgames.co.uk`) resolve to the same store. Never throws.
 */
export function matchSupportedStore(input: string): SupportedStore | null {
  let host: string;
  try {
    host = normalizeHost(new URL(input).hostname);
  } catch {
    return null;
  }
  return (
    SUPPORTED_STORES.find((store) =>
      store.hostnames.some((h) => host === h || host.endsWith(`.${h}`)),
    ) ?? null
  );
}

/** Convenience predicate for the paste field's unsupported-link flag. */
export function isSupportedStoreUrl(input: string): boolean {
  return matchSupportedStore(input) !== null;
}

/**
 * Human label for a pasted URL — the supported store's display name when we
 * recognise it, else the bare hostname, else `null` for an unparseable
 * string. Used by the couldn't-auto-read path (R2-4) to name the host in the
 * message and to seed the vendor column of the row the painter fills in by
 * hand, so a failed scrape still leaves them better off than a blank form.
 */
export function storeLabelForUrl(input: string): string | null {
  const store = matchSupportedStore(input);
  if (store) return store.name;
  try {
    return normalizeHost(new URL(input).hostname) || null;
  } catch {
    return null;
  }
}
