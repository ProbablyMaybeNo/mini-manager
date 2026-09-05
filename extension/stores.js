/**
 * The stores the Mini Mainframe can auto-fill from.
 *
 * MIRRORS `src/lib/scrape/stores.ts` — the server is the source of truth, and
 * `tests/unit/extension/storesParity.test.ts` fails the build if these two
 * lists ever disagree. The duplication is deliberate: the popup needs the list
 * even when it hasn't made a request yet (right after the token is saved, or
 * on a tab whose URL never reaches the server), so fetching it would mean a
 * network round-trip and a new public endpoint to render a static list of five
 * names.
 *
 * Kept in its own module, free of any `chrome.*` API, so the parity test can
 * import it directly under Node.
 */

export const SUPPORTED_STORES = [
  { name: "Element Games", url: "https://elementgames.co.uk" },
  { name: "Wayland Games", url: "https://waylandgames.co.uk" },
  { name: "Noble Knight Games", url: "https://nobleknight.com" },
  { name: "Miniature Market", url: "https://miniaturemarket.com" },
  { name: "Gamers Roll", url: "https://gamersroll.com" },
];
