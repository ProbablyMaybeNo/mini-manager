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
