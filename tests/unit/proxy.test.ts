import { describe, expect, test, vi } from "vitest";

/**
 * The proxy wraps its handler in NextAuth's `auth()`, which pulls the
 * Drizzle adapter + DB client at import. Stub it to an identity wrapper so
 * we can import the pure `isPublicPath` + matcher config in a node unit env.
 */
vi.mock("@/auth", () => ({ auth: (fn: unknown) => fn }));

const { isPublicPath, config } = await import("@/proxy");

// Next anchors the matcher pattern; replicate that so a path the matcher
// MATCHES is funnelled through auth(), and one it does NOT match skips the
// proxy (i.e. is excluded / reachable without a session).
const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("isPublicPath", () => {
  test("token-validated pages are public", () => {
    expect(isPublicPath("/verify-email")).toBe(true);
    expect(isPublicPath("/user/verify-recovery")).toBe(true);
  });

  test("marketing surfaces stay public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/pricing")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
  });

  test("gated app routes are not public", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/user")).toBe(false);
    expect(isPublicPath("/collection")).toBe(false);
  });
});

describe("proxy matcher exclusions", () => {
  test("gated routes are matched (auth runs)", () => {
    expect(matcher.test("/dashboard")).toBe(true);
    expect(matcher.test("/collection")).toBe(true);
    expect(matcher.test("/user")).toBe(true);
  });

  test("opengraph-image + twitter-image are excluded", () => {
    expect(matcher.test("/opengraph-image")).toBe(false);
    expect(matcher.test("/opengraph-image-abc123")).toBe(false);
    expect(matcher.test("/twitter-image")).toBe(false);
    expect(matcher.test("/twitter-image-abc123")).toBe(false);
  });

  test("api/extension is excluded", () => {
    expect(matcher.test("/api/extension/add")).toBe(false);
    expect(matcher.test("/api/extension/preview")).toBe(false);
  });

  test("verify-email + user/verify-recovery are excluded", () => {
    expect(matcher.test("/verify-email")).toBe(false);
    expect(matcher.test("/user/verify-recovery")).toBe(false);
  });
});
