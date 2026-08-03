/**
 * R2-20 — the gate on the test-only sign-in back door
 * (`src/app/api/test/sign-in/route.ts`), which mints a session for ANY email
 * posted to it with no password.
 *
 * It lives here rather than inline in the route because a Next route module
 * may only export route handlers and the framework's own config keys, so the
 * condition could not otherwise be tested directly — and the condition is the
 * whole security property.
 *
 * The route's original gate had the right polarity but exactly ONE condition:
 * `ALLOW_TEST_AUTH !== "1"`. That value travels — builders set it for local
 * dev and the Playwright web server — so a single stray env var (a preview
 * config copy-pasted into the production project) turned it into an open
 * endpoint minting a session for any account, an admin's included. Every
 * other trust boundary in this app already doubles up and fails closed: the
 * admin allowlist, `BILLING_ENFORCED`. This was the one place that pattern
 * was missing, on the endpoint whose failure mode is total account takeover.
 *
 * So: a production runtime refuses regardless of the flag. Opening the route
 * now needs both the flag AND a non-production build, which is not something
 * a copy-pasted env var can do on its own.
 *
 * Precisely: this is a production DENY-list, not a dev/test allow-list — an
 * absent `NODE_ENV` with the flag set still opens the route. That is the
 * condition R2-20 specifies, and it matches the real deployment shapes
 * (`next dev` sets `development`, `next build` sets `production`, vitest sets
 * `test`); tightening it to an allow-list would refuse runtimes nobody has.
 *
 * Note this also covers Vercel PREVIEW deployments, which are `next build`
 * output and therefore run with `NODE_ENV=production`. That is the intended
 * direction: the back door belongs to `next dev` and the local E2E web
 * server, which are the only places it is actually used.
 */
export interface TestAuthEnv {
  NODE_ENV?: string;
  ALLOW_TEST_AUTH?: string;
}

export function testAuthEnabled(env: TestAuthEnv = process.env): boolean {
  // Fail closed on the build mode first — the flag cannot re-open it.
  if (env.NODE_ENV === "production") return false;
  return env.ALLOW_TEST_AUTH === "1";
}
