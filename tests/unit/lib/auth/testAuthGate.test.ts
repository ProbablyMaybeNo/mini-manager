/**
 * R2-20 — the gate on `/api/test/sign-in`, the route that mints a session
 * for any email with no password.
 *
 * This is the durable part of the fix. The route is correctly off in
 * production today; what these tests pin is that it STAYS off when the one
 * env var that used to be its only condition leaks into a production
 * project. The failure mode being defended against is total account
 * takeover, including an admin's, so the condition gets its own tests rather
 * than trusting a code read.
 */
import { describe, expect, test } from "vitest";
import { testAuthEnabled } from "@/lib/auth/testAuthGate";

describe("testAuthEnabled", () => {
  test("a production runtime refuses even with ALLOW_TEST_AUTH=1", () => {
    // The whole point: one stray env var — a preview config copy-pasted into
    // the production project — must no longer be enough.
    expect(
      testAuthEnabled({ NODE_ENV: "production", ALLOW_TEST_AUTH: "1" }),
    ).toBe(false);
  });

  test("the flag alone still gates non-production runtimes", () => {
    expect(testAuthEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(testAuthEnabled({ NODE_ENV: "test" })).toBe(false);
    expect(testAuthEnabled({ NODE_ENV: "development", ALLOW_TEST_AUTH: "0" })).toBe(
      false,
    );
    expect(testAuthEnabled({ NODE_ENV: "development", ALLOW_TEST_AUTH: "" })).toBe(
      false,
    );
    expect(
      testAuthEnabled({ NODE_ENV: "development", ALLOW_TEST_AUTH: "true" }),
    ).toBe(false);
  });

  test("dev and test runtimes with the flag set are allowed — E2E still works", () => {
    // `next dev` (local + the Playwright web server) and the vitest runtime.
    expect(
      testAuthEnabled({ NODE_ENV: "development", ALLOW_TEST_AUTH: "1" }),
    ).toBe(true);
    expect(testAuthEnabled({ NODE_ENV: "test", ALLOW_TEST_AUTH: "1" })).toBe(true);
  });

  test("neither condition alone is the production check", () => {
    expect(testAuthEnabled({})).toBe(false);
    expect(testAuthEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  test("an unrecognised NODE_ENV still needs the flag", () => {
    expect(testAuthEnabled({ NODE_ENV: "staging" })).toBe(false);
  });

  test("documents the residual: this is a production deny-list, not an allow-list", () => {
    // An absent NODE_ENV with the flag set DOES open the route. That is the
    // R2-20 condition as specified, and no real runtime reaches it —
    // `next build` sets production, `next dev` development, vitest test. It
    // is pinned here so a future tightening to an allow-list is a visible,
    // deliberate change rather than a silent one.
    expect(testAuthEnabled({ ALLOW_TEST_AUTH: "1" })).toBe(true);
  });
});
