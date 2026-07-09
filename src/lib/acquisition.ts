/**
 * First-touch acquisition attribution — captures `?ref=` (and `utm_*`)
 * query params on landing and threads them through to signup so we can
 * measure which tracked link (e.g.
 * `mini-mainframe.com/?ref=reddit-minipainting-0709`) produced a signup.
 *
 * The proxy (`src/proxy.ts`) captures the raw request URL and stamps a
 * first-touch cookie; the signup path (`src/lib/auth/signUp.ts`) reads
 * that cookie and persists it onto the new user row. Capture + persist
 * only — no dashboards/reporting yet.
 *
 * Pure functions only (no `next/headers`, no `next/server`) so this
 * module is safe to import from both the edge proxy and node server
 * actions without pulling in runtime-specific globals.
 */

export const ACQUISITION_COOKIE = "mm_ref";
/** ~30 days, matching the "original source wins" first-touch window. */
export const ACQUISITION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const ACQUISITION_QUERY_KEYS = [
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
] as const;

/** Strip to a safe charset and cap length so a query param can't be used
 *  as an injection vector (cookie header, JSON, or future SQL/UI render). */
const SAFE_VALUE_RE = /[^a-zA-Z0-9_\-.:]/g;
const MAX_FIELD_LEN = 120;

function sanitizeAcquisitionValue(raw: string): string {
  return raw.replace(SAFE_VALUE_RE, "").slice(0, MAX_FIELD_LEN);
}

/**
 * Build the JSON payload to stamp into the first-touch cookie (and later
 * the user row) from an incoming request URL's query string. Returns
 * null when none of `ref` / `utm_*` are present — nothing to capture.
 */
export function buildAcquisitionCookieValue(url: URL): string | null {
  const fields: Record<string, string> = {};
  for (const key of ACQUISITION_QUERY_KEYS) {
    const raw = url.searchParams.get(key);
    if (!raw) continue;
    const cleaned = sanitizeAcquisitionValue(raw);
    if (cleaned) fields[key] = cleaned;
  }
  return Object.keys(fields).length > 0 ? JSON.stringify(fields) : null;
}
