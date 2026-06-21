import { describe, expect, test } from "vitest";
import {
  buildExtensionToken,
  verifyExtensionTokenWith,
} from "@/lib/auth/extensionToken";

const SECRET = "test-secret-do-not-use-in-prod";
const USER = "u_abc123XYZ0";

describe("extension token — pure core", () => {
  test("a freshly built token verifies for the same user + version", () => {
    const token = buildExtensionToken(USER, 0, SECRET);
    expect(verifyExtensionTokenWith(token, 0, SECRET)).toBe(USER);
  });

  test("token round-trips at a non-zero version", () => {
    const token = buildExtensionToken(USER, 7, SECRET);
    expect(verifyExtensionTokenWith(token, 7, SECRET)).toBe(USER);
  });

  test("token shape is `<userId>.v<version>.<sig>`", () => {
    const token = buildExtensionToken(USER, 3, SECRET);
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe(USER);
    expect(parts[1]).toBe("v3");
    expect(parts[2]).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
  });

  test("rejects a token whose version no longer matches (regenerated)", () => {
    const token = buildExtensionToken(USER, 0, SECRET);
    // User regenerated → server version is now 1; the old v0 token must fail.
    expect(verifyExtensionTokenWith(token, 1, SECRET)).toBeNull();
  });

  test("rejects a tampered signature", () => {
    const token = buildExtensionToken(USER, 0, SECRET);
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifyExtensionTokenWith(tampered, 0, SECRET)).toBeNull();
  });

  test("rejects a tampered userId (signature won't match)", () => {
    const token = buildExtensionToken(USER, 0, SECRET);
    const [, versionSeg, sig] = token.split(".");
    const forged = `u_evil0000000.${versionSeg}.${sig}`;
    expect(verifyExtensionTokenWith(forged, 0, SECRET)).toBeNull();
  });

  test("rejects a tampered version segment", () => {
    const token = buildExtensionToken(USER, 0, SECRET);
    const [userId, , sig] = token.split(".");
    const forged = `${userId}.v1.${sig}`;
    expect(verifyExtensionTokenWith(forged, 1, SECRET)).toBeNull();
  });

  test("rejects a token signed with a different secret", () => {
    const token = buildExtensionToken(USER, 0, "other-secret");
    expect(verifyExtensionTokenWith(token, 0, SECRET)).toBeNull();
  });

  test("rejects malformed tokens without throwing", () => {
    for (const bad of [
      "",
      "no-dots",
      "only.two",
      "a.b.c.d",
      "user.notversion.sig",
      "user.v-1.sig",
      "user.vNaN.sig",
      ".v0.sig",
    ]) {
      expect(verifyExtensionTokenWith(bad, 0, SECRET)).toBeNull();
    }
  });
});
