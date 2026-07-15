import { describe, expect, test } from "vitest";
import config from "../../next.config";

/**
 * E5 — next/image remotePatterns must NOT be an open `**` wildcard (that made
 * /_next/image an open optimizer/proxy for any host — SSRF + bandwidth abuse).
 * It should allow only the Vercel Blob host where our own uploads live. Pasted
 * reference images render via plain <img>, so they are unaffected.
 */

describe("E5 next/image remotePatterns", () => {
  const patterns = config.images?.remotePatterns ?? [];

  test("no `**` open wildcard host remains", () => {
    for (const p of patterns) {
      expect(p.hostname).not.toBe("**");
    }
  });

  test("blob host is allowed for our own uploads", () => {
    const hosts = patterns.map((p) => p.hostname);
    expect(hosts).toContain("*.public.blob.vercel-storage.com");
  });

  test("no plain-http remote host is allowed", () => {
    for (const p of patterns) {
      expect(p.protocol).toBe("https");
    }
  });
});
