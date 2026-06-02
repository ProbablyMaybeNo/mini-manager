/**
 * Service-worker fetch routing — pure decision logic (P15.4 offline reads).
 *
 * `public/sw.js` is plain JS and runs in the ServiceWorkerGlobalScope, which
 * can't be imported into the Node-env unit suite. So the *decision* of how to
 * handle a given request lives here as a pure, framework-free function and is
 * unit-tested directly; `sw.js` mirrors the exact same rules at runtime.
 *
 * Keep these two in lock-step. The tests in
 * `tests/unit/lib/sw/strategy.test.ts` assert the safety invariants
 * (non-GET / cross-origin / authed / Range requests are never cached) so a
 * future edit to `sw.js` that diverges from this table gets caught.
 *
 * Strategies:
 *   "passthrough"          — fetch(request) untouched. No cache read or write.
 *                            The safe default; anything we're unsure about
 *                            lands here.
 *   "shell-cache-first"    — precached static install assets (manifest/icons).
 *                            Serve from cache, fall back to network.
 *   "navigate-network-first" — same-origin page navigations. Network-first with
 *                            an offline fallback; the response is NEVER cached
 *                            (it may contain authed HTML).
 *   "stale-while-revalidate" — cache-then-network for the static, public paint
 *                            catalog: serve the cached copy instantly, refresh
 *                            in the background.
 */

export type SwStrategy =
  | "passthrough"
  | "shell-cache-first"
  | "navigate-network-first"
  | "stale-while-revalidate";

/** The static install-prompt assets precached on `install`. */
export const SHELL_URLS: readonly string[] = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

/**
 * The one data path we're confident is safe to cache offline: the public,
 * static, cross-user-identical paint catalog. It carries no per-user data, so
 * a cached copy can never leak between accounts.
 */
export const SWR_PATHS: readonly string[] = ["/data/paints.json"];

/**
 * Minimal shape of the bits of a `Request` the router needs. Lets the unit
 * tests pass plain objects without constructing real `Request`s.
 */
export interface SwRequestLike {
  method: string;
  /** Absolute request URL. */
  url: string;
  /** `Request.mode` — "navigate" for top-level page loads. */
  mode?: string;
  /** True if the request carries a `Range` header (partial content). */
  hasRange?: boolean;
  /** True if the request carries an `Authorization` header. */
  hasAuthHeader?: boolean;
}

/**
 * Decide how the SW should handle a request, given the worker's own origin.
 *
 * Safety-first ordering: every reason to bail out (wrong method, cross-origin,
 * Range, Authorization, API route) is checked BEFORE any cache strategy, so the
 * cache can only ever be reached by requests that have cleared every gate.
 */
export function routeRequest(
  req: SwRequestLike,
  selfOrigin: string,
): SwStrategy {
  // 1. Only ever touch GETs. Writes (POST/PUT/PATCH/DELETE) pass straight
  //    through so we never cache or replay a mutation.
  if (req.method !== "GET") return "passthrough";

  // 2. Same-origin only. Third-party requests are none of our business.
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return "passthrough";
  }
  if (url.origin !== selfOrigin) return "passthrough";

  // 3. Range requests fetch a byte-slice (206 Partial Content). Caching a
  //    partial would poison the cache for full reads — and the paint loader
  //    deliberately Range-peeks the catalog header. Always pass through.
  if (req.hasRange) return "passthrough";

  // 4. An Authorization header marks a per-user request. Never cache it.
  if (req.hasAuthHeader) return "passthrough";

  // 5. API + auth routes carry authed / per-user / session data and mutations.
  //    Conservatively pass them through — caching here risks serving one
  //    user's data to another. (Project/dashboard reads render as HTML
  //    navigations, handled by rule 7's network-first, never cached.)
  if (url.pathname.startsWith("/api/")) return "passthrough";

  // 6. Precached static shell assets: cache-first.
  if (SHELL_URLS.includes(url.pathname)) return "shell-cache-first";

  // 7. The public, static paint catalog: stale-while-revalidate.
  if (SWR_PATHS.includes(url.pathname)) return "stale-while-revalidate";

  // 8. Page navigations: network-first with an offline fallback. The HTML is
  //    never cached (it may be authed).
  if (req.mode === "navigate") return "navigate-network-first";

  // 9. Everything else (other same-origin GETs — _next chunks, fonts, user
  //    images, etc.): pass through. We deliberately don't speculatively cache
  //    these in P15.4.
  return "passthrough";
}
