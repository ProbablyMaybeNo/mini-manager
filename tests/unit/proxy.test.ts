import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";

/**
 * The proxy wraps its handler in NextAuth's `auth()`, which pulls the
 * Drizzle adapter + DB client at import. Stub it to an identity wrapper so
 * we can import the pure `isPublicPath` + matcher config in a node unit env.
 */
vi.mock("@/auth", () => ({ auth: (fn: unknown) => fn }));

const { isPublicPath, isKnownRoute, config } = await import("@/proxy");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Next anchors the matcher pattern; replicate that so a path the matcher
// MATCHES is funnelled through auth(), and one it does NOT match skips the
// proxy (i.e. is excluded / reachable without a session).
const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("isPublicPath", () => {
  test("token-validated pages are public", () => {
    expect(isPublicPath("/verify-email")).toBe(true);
    expect(isPublicPath("/user/verify-recovery")).toBe(true);
  });

  test("marketing surfaces stay public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/pricing")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
  });

  test("gated app routes are not public", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/user")).toBe(false);
    expect(isPublicPath("/collection")).toBe(false);
  });
});

describe("proxy matcher exclusions", () => {
  test("gated routes are matched (auth runs)", () => {
    expect(matcher.test("/dashboard")).toBe(true);
    expect(matcher.test("/collection")).toBe(true);
    expect(matcher.test("/user")).toBe(true);
  });

  test("opengraph-image + twitter-image are excluded", () => {
    expect(matcher.test("/opengraph-image")).toBe(false);
    expect(matcher.test("/opengraph-image-abc123")).toBe(false);
    expect(matcher.test("/twitter-image")).toBe(false);
    expect(matcher.test("/twitter-image-abc123")).toBe(false);
  });

  test("api/extension is excluded", () => {
    expect(matcher.test("/api/extension/add")).toBe(false);
    expect(matcher.test("/api/extension/preview")).toBe(false);
  });

  test("verify-email + user/verify-recovery are excluded", () => {
    expect(matcher.test("/verify-email")).toBe(false);
    expect(matcher.test("/user/verify-recovery")).toBe(false);
  });
});

/**
 * R2-7 — unmatched paths must 404, not redirect to sign-in.
 *
 * Live before the fix:
 *   /does-not-exist   → 307 → /sign-in?from=%2Fdoes-not-exist
 *   /totally/made/up  → 307 → /sign-in?from=%2Ftotally%2Fmade%2Fup
 *   /Dashboard        → 307 → /sign-in?from=%2FDashboard
 */
describe("isKnownRoute", () => {
  test("real top-level routes are known (still gated when signed out)", () => {
    for (const p of [
      "/dashboard",
      "/collection",
      "/recipes",
      "/projects/abc123",
      "/tools/match",
      "/user/account",
      "/admin/users",
      "/api/wishlist/list",
      "/r/some-slug",
      "/",
    ]) {
      expect(isKnownRoute(p), p).toBe(true);
    }
  });

  test("paths matching no route are NOT known — they fall through to the 404", () => {
    for (const p of ["/does-not-exist", "/totally/made/up", "/nope"]) {
      expect(isKnownRoute(p), p).toBe(false);
    }
  });

  test("matching is case-sensitive, like the App Router itself", () => {
    // The live case slip: /Dashboard is not a route, so it must 404 rather
    // than imply the real page is behind a paywall.
    expect(isKnownRoute("/Dashboard")).toBe(false);
    expect(isKnownRoute("/Collection")).toBe(false);
    expect(isKnownRoute("/dashboard")).toBe(true);
  });

  test("legacy next.config redirect sources stay known", () => {
    // Independent of whether config redirects run before or after the proxy.
    for (const p of ["/planner", "/projects", "/collections", "/wishlist"]) {
      expect(isKnownRoute(p), p).toBe(true);
    }
  });

  /**
   * Drift guard: a new top-level route added to src/app/ without being listed
   * in KNOWN_ROOT_SEGMENTS would 404 for every signed-out visitor. Re-derive
   * the inventory from the filesystem rather than trusting the list.
   */
  test("every top-level route directory under src/app is known", () => {
    const appDir = path.join(root, "src/app");
    const segments = new Set<string>();

    const collect = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        // Route groups — "(app)", "(public)" — are not URL segments; their
        // children are the real top-level routes.
        if (entry.name.startsWith("(") && entry.name.endsWith(")")) {
          collect(path.join(dir, entry.name));
          continue;
        }
        // Private folders (_helpers) and parallel/intercepting routes are not
        // addressable paths.
        if (entry.name.startsWith("_") || entry.name.startsWith("@")) continue;
        segments.add(entry.name);
      }
    };
    collect(appDir);

    expect(segments.size).toBeGreaterThan(10);
    const missing = [...segments].filter((s) => !isKnownRoute(`/${s}`));
    expect(missing, "add these to KNOWN_ROOT_SEGMENTS in src/proxy.ts").toEqual([]);
  });
});
