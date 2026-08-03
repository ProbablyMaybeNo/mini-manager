/**
 * R2-16 — where a visitor lands after signing in or signing up.
 *
 * Callers like `/pricing` pass `?from=` so an interrupted upgrade resumes
 * where it left off, which means an attacker-supplied string reaches
 * `redirect()`. Only internal, single-leading-slash paths are honoured;
 * anything else falls back to the dashboard.
 *
 * Lives in its own module rather than inside `lib/actions/auth.ts` because
 * that file is `"use server"`, where every export must be an async server
 * action — so the guard could not be exported, and therefore could not be
 * unit-tested, from there. This is the whole security boundary for both auth
 * entry points; it should be the easiest thing in the app to test.
 */

/** Where an unhonoured `next` sends the visitor instead. */
export const POST_AUTH_FALLBACK = "/dashboard";

/** Characters the browser rewrites or drops before it parses a URL, and which
 *  therefore cannot be trusted to still be there when the redirect resolves:
 *  the C0 control range, DEL, and backslash. */
function isBrowserRewritten(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code < 0x20 || code === 0x7f || ch === "\\";
}

/**
 * The previous guard was `next.startsWith("/") && !next.startsWith("//")`.
 * It correctly rejected `https://evil.com` and protocol-relative
 * `//evil.com`, and it was NOT enough.
 *
 * The check runs on the RAW string, so it has to account for what the browser
 * does to that string BEFORE parsing it: Chrome and Firefox normalise `\` to
 * `/`, and strip TAB / LF / CR from anywhere in a URL. Several strings that
 * start with exactly one `/` therefore reach the network stack as
 * `//evil.com` — a protocol-relative URL to someone else's host.
 *
 * Confirmed against a real sign-up in a real browser, not reasoned about:
 *
 *   `/\evil.com`       → landed on http://evil.com/    ESCAPED
 *   `/\/evil.com`      → landed on http://evil.com/    ESCAPED
 *   `/<TAB>/evil.com`  → landed on http://evil.com/    ESCAPED
 *   `//evil.com`       → /dashboard                    held
 *   `https://evil.com` → /dashboard                    held
 *   `/pricing`         → /pricing                      honoured
 *
 * The TAB case is why this rejects control characters as well as `\`: a
 * backslash-only clause would have closed two of the three and left the third
 * open, looking fixed.
 *
 * Impact is modest — the victim must follow a crafted link AND authenticate
 * before landing off-site — so this is a phishing aid rather than account
 * takeover. It is still an open redirect on the two pages whose entire job is
 * establishing trust.
 */
export function safePostAuthPath(next?: string): string {
  if (!next) return POST_AUTH_FALLBACK;
  for (const ch of next) {
    if (isBrowserRewritten(ch)) return POST_AUTH_FALLBACK;
  }
  if (!next.startsWith("/") || next.startsWith("//")) return POST_AUTH_FALLBACK;
  return next;
}
