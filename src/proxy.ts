import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ACQUISITION_COOKIE,
  ACQUISITION_COOKIE_MAX_AGE_SECONDS,
  buildAcquisitionCookieValue,
} from "@/lib/acquisition";

/**
 * Session-gated edge proxy (formerly `middleware.ts` — renamed per
 * the Next 16 convention).
 *
 * Anything not explicitly allow-listed by the `matcher` below funnels
 * through `auth(...)`. Unauthenticated requests get a 302 to `/sign-in`
 * with the original path stashed in `?from=` so we can bounce them back
 * after sign-in (NextAuth honours `callbackUrl` natively; we mirror it
 * as `from` for any custom UI that wants to read it).
 */
/**
 * Public marketing surfaces a signed-out visitor must be able to reach.
 * The landing (`/`) and pricing pages own their own auth handling (the
 * landing bounces *authed* users to /projects); gating them here defeats
 * them entirely. `/sign-in` / `/sign-up` / `/r` are already matcher-
 * excluded, so they don't need listing.
 */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname.startsWith("/pricing/") ||
    // Search-intent landing pages — crawlable, signed-out, and listed in the
    // sitemap. Without this they 307 to /sign-in and the crawler indexes the
    // sign-in page instead of the content.
    pathname === "/paint-collection-manager" ||
    pathname === "/miniature-wargame-project-tracker" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/verify-email" ||
    pathname === "/user/verify-recovery" ||
    // Dev-only theme studio (/dev/*) — public in dev so it needs no sign-in;
    // the page itself 404s in production, so this is a no-op there.
    (process.env.NODE_ENV !== "production" && pathname.startsWith("/dev"))
  );
}

/**
 * R2-7 — the first path segment of every route this app actually serves.
 *
 * The matcher below is a DENY-list: anything it doesn't explicitly exclude
 * funnels through `auth(...)`, which treated every unmatched path as a
 * protected route. So `/does-not-exist` 307'd to `/sign-in?from=…`, and so did
 * `/totally/made/up` and `/Dashboard` (a case slip on a real route — App
 * Router paths are case-sensitive). The branded 404 existed and worked for
 * `/r/nope-not-real`, but no unmatched TOP-LEVEL path could ever reach it.
 * A visitor was told the content needs an account when it simply isn't there,
 * and a crawler got a soft-404 into the sign-in page.
 *
 * Matching is on the first segment only, and deliberately so: deeper paths are
 * dynamic (`/projects/[id]`, `/recipes/[id]`, `/r/[slug]`) and enumerating them
 * here would mean re-implementing the router. A nonexistent path UNDER a real
 * route still redirects when signed out; every case the audit found is a
 * top-level one, and this is the version that can't rot into gating a real
 * route by accident.
 *
 * `tests/unit/proxy.test.ts` re-derives this list from `src/app/` and fails if
 * a new top-level route is added without being listed — the drift that would
 * otherwise 404 a real page for signed-out visitors.
 */
const KNOWN_ROOT_SEGMENTS = new Set([
  // (app) — session-gated surfaces.
  "collection",
  "dashboard",
  "focus",
  "gallery",
  "library",
  "projects",
  "recipes",
  "tools",
  "user",
  // Standalone trees.
  "admin",
  "api",
  "auth",
  "dev",
  "r",
  // (public) — these return early via isPublicPath / the matcher, listed so
  // the set stays a truthful inventory of what the app serves.
  "miniature-wargame-project-tracker",
  "paint-collection-manager",
  "pricing",
  "privacy",
  "reset",
  "sign-in",
  "sign-up",
  "terms",
  "verify-email",
  // Legacy aliases redirected in next.config.ts. Listed so this check can
  // never depend on whether config redirects run before or after the proxy.
  "collections",
  "planner",
  "wishlist",
]);

/**
 * Does `pathname` belong to a route this app serves? Case-sensitive, matching
 * the App Router — `/Dashboard` is not `/dashboard` and must 404, not gate.
 */
export function isKnownRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return KNOWN_ROOT_SEGMENTS.has(pathname.split("/")[1] ?? "");
}

/**
 * First-touch acquisition capture (?ref= / utm_*). Only writes the cookie
 * when it isn't already set, so the ORIGINAL source wins over later
 * visits — a bookmark revisit or an internal link click never overwrites
 * the link that actually brought the visitor in.
 */
function withAcquisitionCookie(
  res: NextResponse,
  hasExistingCookie: boolean,
  url: URL,
): NextResponse {
  if (hasExistingCookie) return res;
  const value = buildAcquisitionCookieValue(url);
  if (!value) return res;
  res.cookies.set(ACQUISITION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: ACQUISITION_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}

export default auth((req) => {
  const hasAcquisitionCookie = Boolean(req.cookies.get(ACQUISITION_COOKIE));

  if (req.auth?.user)
    return withAcquisitionCookie(NextResponse.next(), hasAcquisitionCookie, req.nextUrl);
  if (isPublicPath(req.nextUrl.pathname))
    return withAcquisitionCookie(NextResponse.next(), hasAcquisitionCookie, req.nextUrl);

  // R2-7 — a path that matches no route we serve is GONE, not gated. Let it
  // through to the filesystem, where it finds nothing and Next renders the
  // branded 404 with a real 404 status.
  if (!isKnownRoute(req.nextUrl.pathname))
    return withAcquisitionCookie(NextResponse.next(), hasAcquisitionCookie, req.nextUrl);

  const url = req.nextUrl.clone();
  const from = url.pathname + (url.search || "");
  const signInUrl = new URL("/sign-in", req.nextUrl.origin);
  if (from && from !== "/" && from !== "/sign-in") {
    signInUrl.searchParams.set("from", from);
  }
  return withAcquisitionCookie(
    NextResponse.redirect(signInUrl),
    hasAcquisitionCookie,
    req.nextUrl,
  );
});

/**
 * Skip the proxy for:
 *   - `/sign-in`              the sign-in screen itself (includes
 *                              `/sign-in/forgot` and `/sign-in/reset`
 *                              under it — matcher excludes the whole
 *                              prefix)
 *   - `/sign-up`              the credentials sign-up page (P9.3)
 *   - `/api/auth/*`           NextAuth's route handlers + the auth-
 *                              ancillary `check-username`,
 *                              `has-recovery-email` probes (P9.3 / P9.4)
 *   - `/api/test/*`           the test reset endpoint
 *   - `/r/*`                  public recipe view (P5.2 — anyone with the
 *                              slug URL can read; auth is NOT required)
 *   - `/verify-email`,        token-validated pages that need no session
 *     `/user/verify-recovery`
 *   - `opengraph-image`,      metadata image routes for link unfurls —
 *     `twitter-image`         must never redirect or crawlers get no image
 *   - `/api/extension/*`      Bearer-token API; the route runs its own auth
 *   - `/_next/*`              Next.js internals (static, image, RSC payloads)
 *   - `favicon.ico` + assets  obvious public files
 *   - `/brand/*`              brand artwork served from /public/brand/
 *                              (the logo on the auth pages)
 *
 * Everything else hits `auth(...)` and gets redirected if unauthenticated.
 */
export const config = {
  matcher: [
    // `googleb…html` is the Google Search Console file-verification token —
    // GSC fetches it without following redirects, so it must stay un-gated
    // (same rationale as robots.txt / sitemap.xml above).
    "/((?!sign-in|sign-up|reset|gallery|verify-email|user/verify-recovery|opengraph-image|twitter-image|api/auth|api/test|api/billing|api/extension|r/|brand/|data/|icons/|tools/|logo.png|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|googleb42109f0776d368a.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf|otf|webmanifest)).*)",
  ],
};
