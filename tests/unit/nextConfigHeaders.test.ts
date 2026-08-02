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
