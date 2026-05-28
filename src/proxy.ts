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
export default auth((req) => {
  if (req.auth?.user) return;

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
 *   - `/sign-in`              the sign-in screen itself
 *   - `/api/auth/*`           NextAuth's route handlers
 *   - `/_next/*`              Next.js internals (static, image, RSC payloads)
 *   - `favicon.ico` + assets  obvious public files
 *
 * Everything else hits `auth(...)` and gets redirected if unauthenticated.
 */
export const config = {
  matcher: [
    "/((?!sign-in|api/auth|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)).*)",
  ],
};
