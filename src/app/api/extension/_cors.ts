import { NextResponse } from "next/server";

/**
 * CORS for the browser-extension API.
 *
 * The extension's popup fetches these routes from a `chrome-extension://`
 * origin, so we reflect that origin in `Access-Control-Allow-Origin` and
 * permit the `Authorization` header it sends the bearer token in. We only
 * echo `chrome-extension://*` origins (and the app's own origins for
 * local testing) — never a wildcard reflect of arbitrary sites.
 */

const ALLOWED_APP_ORIGINS = new Set([
  "https://mini-mainframe.com",
  "https://www.mini-mainframe.com",
  "https://miniaturemanager.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
]);

/** Decide which `Access-Control-Allow-Origin` value to echo, if any. */
function resolveAllowOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (origin.startsWith("chrome-extension://")) return origin;
  if (ALLOWED_APP_ORIGINS.has(origin)) return origin;
  return null;
}

/** Build the CORS header set for a given request origin. */
export function corsHeaders(origin: string | null): Record<string, string> {
  const allow = resolveAllowOrigin(origin);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allow) headers["Access-Control-Allow-Origin"] = allow;
  return headers;
}

/** Standard preflight response. */
export function preflight(req: Request): NextResponse {
  const origin = req.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

/** JSON response with CORS headers attached. */
export function corsJson(
  req: Request,
  body: unknown,
  status = 200,
): NextResponse {
  const origin = req.headers.get("origin");
  return NextResponse.json(body, { status, headers: corsHeaders(origin) });
}

/**
 * Extract the bearer token from the `Authorization` header, or null when
 * absent / malformed.
 */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}
