import { NextResponse } from "next/server";
import { auth } from "@/auth";

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
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname.startsWith("/pricing/")
  );
}

export default auth((req) => {
  if (req.auth?.user) return;
  if (isPublicPath(req.nextUrl.pathname)) return;

  const url = req.nextUrl.clone();
  const from = url.pathname + (url.search || "");
  const signInUrl = new URL("/sign-in", req.nextUrl.origin);
  if (from && from !== "/" && from !== "/sign-in") {
    signInUrl.searchParams.set("from", from);
  }
  return NextResponse.redirect(signInUrl);
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
 *   - `/_next/*`              Next.js internals (static, image, RSC payloads)
 *   - `favicon.ico` + assets  obvious public files
 *   - `/brand/*`              brand artwork served from /public/brand/
 *                              (the logo on the auth pages)
 *
 * Everything else hits `auth(...)` and gets redirected if unauthenticated.
 */
export const config = {
  matcher: [
    "/((?!sign-in|sign-up|api/auth|api/test|r/|brand/|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf|otf)).*)",
  ],
};
