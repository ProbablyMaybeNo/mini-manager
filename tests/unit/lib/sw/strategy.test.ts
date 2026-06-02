/**
 * Service-worker fetch routing — P15.4 offline reads.
 *
 * These tests pin the SAFETY invariants of the cache strategy: the SW must
 * never cache non-GET, cross-origin, Range, Authorization-bearing, or /api/
 * requests (any of which could leak one user's data to another or poison the
 * cache). They also lock the two things we DO cache: the static shell and the
 * public paint catalog (stale-while-revalidate).
 *
 * `public/sw.js` mirrors `routeRequest`'s rule ordering at runtime; a divergent
 * `sw.js` edit shows up here as the contract drifting from the source-text
 * sentinel at the bottom of this file.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  routeRequest,
  SHELL_URLS,
  SWR_PATHS,
  type SwRequestLike,
} from "@/lib/sw/strategy";

const ORIGIN = "https://app.minimanager.test";

function req(overrides: Partial<SwRequestLike> & { url: string }): SwRequestLike {
  return { method: "GET", ...overrides };
}

describe("routeRequest — stale-while-revalidate (the offline read)", () => {
  test("the public paint catalog is cached stale-while-revalidate", () => {
    expect(routeRequest(req({ url: `${ORIGIN}/data/paints.json` }), ORIGIN)).toBe(
      "stale-while-revalidate",
    );
  });

  test("a catalog request with a query string still SWR-caches by pathname", () => {
    expect(
      routeRequest(req({ url: `${ORIGIN}/data/paints.json?v=2` }), ORIGIN),
    ).toBe("stale-while-revalidate");
  });

  test("SWR_PATHS contains the catalog and nothing user-scoped", () => {
    expect(SWR_PATHS).toContain("/data/paints.json");
    for (const p of SWR_PATHS) {
      expect(p.startsWith("/api/")).toBe(false);
    }
  });
});

describe("routeRequest — shell + navigations", () => {
  test("every precached shell asset is cache-first", () => {
    for (const p of SHELL_URLS) {
      expect(routeRequest(req({ url: `${ORIGIN}${p}` }), ORIGIN)).toBe(
        "shell-cache-first",
      );
    }
  });

  test("a same-origin page navigation is network-first (never cached)", () => {
    expect(
      routeRequest(req({ url: `${ORIGIN}/projects`, mode: "navigate" }), ORIGIN),
    ).toBe("navigate-network-first");
  });

  test("authed project/dashboard navigations are network-first, not cached", () => {
    expect(
      routeRequest(
        req({ url: `${ORIGIN}/projects/abc123`, mode: "navigate" }),
        ORIGIN,
      ),
    ).toBe("navigate-network-first");
  });
});

describe("routeRequest — safety: never cache these (P15.1 invariants preserved)", () => {
  test("non-GET methods pass through (no caching/replay of mutations)", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(
        routeRequest(req({ url: `${ORIGIN}/data/paints.json`, method }), ORIGIN),
      ).toBe("passthrough");
      expect(
        routeRequest(req({ url: `${ORIGIN}/api/projects`, method }), ORIGIN),
      ).toBe("passthrough");
    }
  });

  test("cross-origin GETs pass through untouched", () => {
    expect(
      routeRequest(req({ url: "https://cdn.other.test/data/paints.json" }), ORIGIN),
    ).toBe("passthrough");
    expect(
      routeRequest(req({ url: "https://fonts.googleapis.com/css" }), ORIGIN),
    ).toBe("passthrough");
  });

  test("/api/** is always pass-through (authed data, never cross-user cached)", () => {
    for (const p of [
      "/api/projects",
      "/api/auth/session",
      "/api/trpc/recipes.list",
    ]) {
      expect(routeRequest(req({ url: `${ORIGIN}${p}` }), ORIGIN)).toBe(
        "passthrough",
      );
    }
  });

  test("Range requests pass through (don't cache 206 partials)", () => {
    // The paint loader Range-peeks the catalog header; caching a partial
    // would poison the cache for full reads.
    expect(
      routeRequest(
        req({ url: `${ORIGIN}/data/paints.json`, hasRange: true }),
        ORIGIN,
      ),
    ).toBe("passthrough");
  });

  test("Authorization-bearing requests pass through (per-user)", () => {
    expect(
      routeRequest(
        req({ url: `${ORIGIN}/data/paints.json`, hasAuthHeader: true }),
        ORIGIN,
      ),
    ).toBe("passthrough");
  });

  test("an unrecognised same-origin GET (e.g. a _next chunk) passes through", () => {
    expect(
      routeRequest(req({ url: `${ORIGIN}/_next/static/chunk.js` }), ORIGIN),
    ).toBe("passthrough");
  });

  test("a malformed URL passes through rather than throwing", () => {
    expect(routeRequest(req({ url: "not a url" }), ORIGIN)).toBe("passthrough");
  });
});

describe("public/sw.js mirrors the strategy contract", () => {
  const swSrc = fs.readFileSync(
    path.resolve(__dirname, "../../../../", "public/sw.js"),
    "utf-8",
  );

  test("sw.js caches the same SWR path as the strategy module", () => {
    for (const p of SWR_PATHS) {
      expect(swSrc).toContain(p);
    }
  });

  test("sw.js still bails on non-GET", () => {
    expect(swSrc).toContain('request.method !== "GET"');
  });

  test("sw.js still bails on cross-origin", () => {
    expect(swSrc).toContain("url.origin !== self.location.origin");
  });

  test("sw.js bails on Range + Authorization headers", () => {
    expect(swSrc).toContain('request.headers.has("range")');
    expect(swSrc).toContain('request.headers.has("authorization")');
  });

  test("sw.js passes /api/ through (no authed-data caching)", () => {
    expect(swSrc).toContain('url.pathname.startsWith("/api/")');
  });

  test("sw.js implements a stale-while-revalidate helper", () => {
    expect(swSrc).toContain("staleWhileRevalidate");
  });

  test("sw.js only caches full 200 responses (no partials/errors)", () => {
    expect(swSrc).toContain("response.status === 200");
  });

  test("sw.js keeps the navigate network-first offline fallback", () => {
    expect(swSrc).toContain("offlineNavigationResponse");
    expect(swSrc).toContain('request.mode === "navigate"');
  });

  // UX-1505 — cache-versioning so a new deploy reaches returning users
  // without a manual cache clear (this is what stranded the Round-13 batch
  // behind the never-bumped `mm-shell-v1` cache + the only React #418).
  test("sw.js derives every cache name from a per-deploy BUILD_ID token", () => {
    // The build-time placeholder the postbuild stamp script replaces.
    expect(swSrc).toContain("__BUILD_ID__");
    // Cache names are templated off BUILD_ID, not a fixed literal.
    expect(swSrc).toContain("`mm-shell-${BUILD_ID}`");
    expect(swSrc).toContain("`mm-data-${BUILD_ID}`");
    // The old never-bumped literal is gone.
    expect(swSrc).not.toContain('"mm-shell-v1"');
  });

  test("sw.js takes over immediately: skipWaiting on install, claim on activate", () => {
    expect(swSrc).toContain("self.skipWaiting()");
    expect(swSrc).toContain("self.clients.claim()");
  });

  test("sw.js deletes caches from a prior BUILD_ID on activate", () => {
    expect(swSrc).toContain("KEEP_CACHES");
    expect(swSrc).toContain("caches.delete(key)");
  });
});
