import { describe, expect, test } from "vitest";
import config from "../../next.config";

/**
 * E4 — verify the security headers are wired into next.config's headers().
 * These are what land on every built response; the assertions here are the
 * unit-level proof of "headers present" (the built-response check is the
 * Group-E `npm run build`).
 */

async function globalHeaders(): Promise<Record<string, string>> {
  const rules = await config.headers!();
  const rule = rules.find((r) => r.source === "/:path*");
  expect(rule, "expected a global /:path* header rule").toBeDefined();
  return Object.fromEntries(rule!.headers.map((h) => [h.key, h.value]));
}

describe("E4 security headers", () => {
  test("CSP is shipped report-only (not enforced yet) with frame-ancestors none", async () => {
    const h = await globalHeaders();
    expect(h["Content-Security-Policy-Report-Only"]).toBeDefined();
    // Must NOT enforce yet — no enforcing header.
    expect(h["Content-Security-Policy"]).toBeUndefined();
    expect(h["Content-Security-Policy-Report-Only"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(h["Content-Security-Policy-Report-Only"]).toContain("default-src 'self'");
  });

  test("clickjacking + sniffing + referrer + permissions headers present", async () => {
    const h = await globalHeaders();
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("geolocation=()");
  });

  test("R2-5 — the camera is granted to this origin, not denied to everyone", async () => {
    // `camera=()` is an empty allowlist: it denies the camera to EVERY origin,
    // ours included, which made the Eyedropper's live sampler impossible while
    // still showing its USE CAMERA button. `(self)` is the narrowest value that
    // lets our own getUserMedia call run.
    const policy = (await globalHeaders())["Permissions-Policy"];
    expect(policy).toContain("camera=(self)");
    expect(policy).not.toContain("camera=()");
    // Everything we don't use stays denied to everyone.
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
    expect(policy).toContain("browsing-topics=()");
  });

  test("HSTS carries includeSubDomains", async () => {
    const h = await globalHeaders();
    expect(h["Strict-Transport-Security"]).toContain("max-age=");
    expect(h["Strict-Transport-Security"]).toContain("includeSubDomains");
  });
});

/**
 * R2-8 — the CSP is report-only with no reporting endpoint, so it blocks
 * nothing and collects nothing. That state is a deliberate, documented one
 * (see the comment in next.config.ts); what must never happen is someone
 * "finishing the job" by renaming the header key to the enforcing form without
 * ever having collected a single violation report. That flips an unverified
 * policy on against real users' renders — and this app's own policy notes say
 * enforcing it as written would break the render.
 *
 * So: enforcing is allowed ONLY once a report sink exists. The test is the
 * guard the comment can't be.
 */
describe("R2-8 CSP may not be enforced without a reporting endpoint", () => {
  const REPORT_DIRECTIVE = /report-uri\s|report-to\s/;

  test("the current header is report-only, and honestly has no report sink", async () => {
    const h = await globalHeaders();
    const policy = h["Content-Security-Policy-Report-Only"];
    expect(policy).toBeDefined();
    expect(h["Content-Security-Policy"]).toBeUndefined();
    // Documents today's truth rather than asserting an aspiration: nothing is
    // collected. When step 1 in the next.config comment is taken, this
    // expectation flips to `toMatch` and the enforcement test below unlocks.
    expect(policy).not.toMatch(REPORT_DIRECTIVE);
    expect(h["Reporting-Endpoints"]).toBeUndefined();
  });

  test("IF the policy is ever enforced, it must carry a report endpoint", async () => {
    const h = await globalHeaders();
    const enforced = h["Content-Security-Policy"];
    if (!enforced) return; // still report-only — nothing to check
    expect(
      REPORT_DIRECTIVE.test(enforced) || Boolean(h["Reporting-Endpoints"]),
      "CSP was switched to enforcing with no report-uri / report-to / " +
        "Reporting-Endpoints — you cannot have verified it is safe to enforce, " +
        "because no violation report was ever collected. See the R2-8 note in " +
        "next.config.ts.",
    ).toBe(true);
  });

  test("script-src is still the loose part — enforcing alone is modest hardening", async () => {
    // Recorded so the scale of the win stays honest: with 'unsafe-inline' and
    // 'unsafe-eval' allowed, enforcing this policy is not XSS protection.
    // If this assertion ever fails, script-src got tightened — good news, and
    // the "modest gain" caveat in next.config.ts should be revisited.
    const policy = (await globalHeaders())["Content-Security-Policy-Report-Only"];
    expect(policy).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });
});
