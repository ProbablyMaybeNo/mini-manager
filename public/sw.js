/*
 * The Mini Mainframe service worker.
 *
 * P15.1 (PWA installability + app-shell offline) shipped the precache + the
 * network-first navigation handler. P15.4 (offline reads) adds a
 * stale-while-revalidate cache for the public, static paint catalog so the
 * /library works offline, while keeping every authed / mutating / cross-origin
 * request strictly pass-through.
 *
 * The routing decision is mirrored from `src/lib/sw/strategy.ts`
 * (`routeRequest`), which is unit-tested. Keep the two in lock-step — the rule
 * ordering below matches that function exactly.
 *
 * What we cache:
 *   - static shell assets (manifest + icons)          → cache-first
 *   - /data/paints.json (public static catalog)       → stale-while-revalidate
 * What we NEVER cache (always pass through to network):
 *   - any non-GET (POST/PUT/PATCH/DELETE — writes/mutations)
 *   - cross-origin requests
 *   - Range requests (206 partials — would poison the cache; the paint loader
 *     Range-peeks the catalog header)
 *   - requests carrying an Authorization header
 *   - /api/** (authed data, session, mutations) — conservative, avoids any
 *     chance of serving one user's data to another
 *   - page navigations' HTML (network-first, offline fallback, response not
 *     cached because it may be authed)
 */

/*
 * UX-1505 — cache-versioning. The shell cache name used to be a fixed
 * `mm-shell-v1` literal that NEVER changed across deploys, so returning
 * users kept being served the OLD precached shell (manifest/icons) and the
 * prior stale build stranded the whole Round-13 batch behind a cache that
 * would only self-invalidate by chance (this caused the only React #418
 * hydration mismatch: old cached shell vs new JS bundle).
 *
 * The fix: derive every cache name from a per-deploy BUILD_ID. The
 * `__BUILD_ID__` token is stamped at build time by
 * `scripts/stamp-sw-build-id.mjs` (the `postbuild` npm hook) with the
 * Vercel commit SHA / a timestamp fallback, so each deploy gets brand-new
 * cache names. On `activate` every cache NOT in KEEP_CACHES (i.e. every
 * cache from a previous BUILD_ID) is deleted, and skipWaiting() +
 * clients.claim() make the new worker take over immediately — a fresh
 * deploy now reaches returning users WITHOUT a manual cache clear.
 *
 * The literal token must stay exactly `__BUILD_ID__` so the stamp script's
 * replace finds it; in dev (unstamped) it falls back to "dev", which still
 * produces valid, namespaced cache names.
 */
const BUILD_ID = "__BUILD_ID__".startsWith("__") ? "dev" : "__BUILD_ID__";

const SHELL_CACHE = `mm-shell-${BUILD_ID}`;
const DATA_CACHE = `mm-data-${BUILD_ID}`;
const KEEP_CACHES = [SHELL_CACHE, DATA_CACHE];

const SHELL_URLS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

// Public, static, cross-user-identical reads that are safe to cache offline.
const SWR_PATHS = ["/data/paints.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !KEEP_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 1. Only ever touch GETs. Writes pass straight through, never cached.
  if (request.method !== "GET") return;

  // 2. Same-origin only.
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // 3. Range requests (206 partials) — never cache.
  if (request.headers.has("range")) return;

  // 4. Authorization header marks a per-user request — never cache.
  if (request.headers.has("authorization")) return;

  // 5. API + auth routes: authed data / session / mutations — pass through.
  if (url.pathname.startsWith("/api/")) return;

  // 6. Precached static shell assets: cache-first.
  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    );
    return;
  }

  // 7. Public static catalog: stale-while-revalidate. Serve the cached copy
  //    instantly (offline reads), kick off a background refresh, and fall back
  //    to the network on a cold cache.
  if (SWR_PATHS.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 8. Navigations: network-first, offline HTML fallback. Response NOT cached.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => offlineNavigationResponse()),
    );
    return;
  }

  // 9. Everything else: pass through, no caching.
});

/**
 * Stale-while-revalidate: respond from cache immediately if present, while
 * always firing a network fetch that refreshes the cache for next time. On a
 * cold cache (first visit / never fetched) we await the network. Only cache
 * a successful, full (status 200, non-partial) response.
 */
function staleWhileRevalidate(request) {
  return caches.open(DATA_CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      // Cached hit → serve instantly, revalidate in the background.
      // Cold cache → wait for the network.
      return cached || network;
    }),
  );
}

function offlineNavigationResponse() {
  return new Response(
    "<!doctype html><meta charset=utf-8><title>Offline</title>" +
      "<body style=\"font-family:monospace;background:#0a0a0a;color:#f5f5f5;" +
      "display:grid;place-items:center;height:100vh;margin:0\">" +
      "<p>OFFLINE — reconnect to load The Mini Mainframe.</p>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
