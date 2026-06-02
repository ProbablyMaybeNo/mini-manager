/*
 * Mini Manager service worker — P15.1 (PWA installability + app-shell offline).
 *
 * SCOPE (deliberately minimal): register + precache a tiny static app shell so
 * the app is installable and the start_url responds offline. This worker does
 * NOT cache authed data (project/library JSON, API routes) — offline reads are
 * P15.4 and will add a dedicated cache-then-network strategy there. Caching
 * authed responses here would risk serving one user's data to another, so we
 * explicitly pass those through to the network.
 *
 * Strategy:
 *   - install:  precache the manifest + icons (the install-prompt assets).
 *   - activate: drop old caches when CACHE_VERSION bumps.
 *   - fetch:    same-origin GET navigations → network-first, fall back to the
 *               cached /projects shell when offline. Everything else (POST,
 *               cross-origin, API/data) → straight to the network, untouched.
 */

const CACHE_VERSION = "mm-shell-v1";
const SHELL_URLS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
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
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever touch same-origin GETs. Leave POST/PUT (write actions),
  // cross-origin, and non-GET requests entirely alone.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for the precached static shell assets.
  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    );
    return;
  }

  // Navigations: network-first so authed pages are always fresh online,
  // but fall back to a cached shell when the network is gone. We do NOT
  // cache the navigation response itself (it may contain authed HTML).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/manifest.json").then(
          () =>
            new Response(
              "<!doctype html><meta charset=utf-8><title>Offline</title>" +
                "<body style=\"font-family:monospace;background:#0a0a0a;color:#f5f5f5;" +
                "display:grid;place-items:center;height:100vh;margin:0\">" +
                "<p>OFFLINE — reconnect to load Mini Manager.</p>",
              { headers: { "Content-Type": "text/html; charset=utf-8" } },
            ),
        ),
      ),
    );
    return;
  }

  // Everything else (API/data fetches): pass through, no caching here.
});
