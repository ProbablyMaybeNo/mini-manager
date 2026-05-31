import { describe, expect, test } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  RESERVED_USERNAMES,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validatePassword,
  validateUsername,
} from "@/lib/auth/validation";

describe("validateUsername", () => {
  test("accepts lowercase letters + digits", () => {
    expect(validateUsername("alice42")).toEqual({
      ok: true,
      normalized: "alice42",
    });
  });

  test("accepts underscores + hyphens after first char", () => {
    expect(validateUsername("alice_42").ok).toBe(true);
    expect(validateUsername("alice-42").ok).toBe(true);
  });

  test("normalises uppercase + trims whitespace", () => {
    expect(validateUsername("  Alice42  ")).toEqual({
      ok: true,
      normalized: "alice42",
    });
  });

  test(`rejects shorter than ${USERNAME_MIN_LENGTH} chars`, () => {
    const r = validateUsername("ab");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("too-short");
  });

  test(`rejects longer than ${USERNAME_MAX_LENGTH} chars`, () => {
    const r = validateUsername("a".repeat(21));
    expect(r.ok).toBe(false);
    expect(r.error).toBe("too-long");
  });

  test("rejects leading hyphen or underscore", () => {
    expect(validateUsername("-alice").error).toBe("must-start-with-alnum");
    expect(validateUsername("_alice").error).toBe("must-start-with-alnum");
  });

  test("rejects spaces + punctuation", () => {
    expect(validateUsername("alice 42").error).toBe("invalid-chars");
    expect(validateUsername("alice.42").error).toBe("invalid-chars");
    expect(validateUsername("alice!").error).toBe("invalid-chars");
  });

  test("rejects reserved words case-insensitively", () => {
    for (const reserved of RESERVED_USERNAMES) {
      expect(validateUsername(reserved).error).toBe("reserved");
      expect(validateUsername(reserved.toUpperCase()).error).toBe("reserved");
    }
  });

  test("rejects empty / whitespace-only", () => {
    expect(validateUsername("").error).toBe("empty");
    expect(validateUsername("   ").error).toBe("empty");
  });
});

describe("validatePassword", () => {
  test("accepts a sufficiently long password", () => {
    expect(validatePassword("abcdefgh").ok).toBe(true);
    expect(validatePassword("a long password with spaces").ok).toBe(true);
  });

  test(`rejects shorter than ${PASSWORD_MIN_LENGTH} chars`, () => {
    const r = validatePassword("abc");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("too-short");
  });

  test("rejects empty", () => {
    expect(validatePassword("").error).toBe("empty");
  });

  test("does NOT require character classes (no complexity gate)", () => {
    expect(validatePassword("aaaaaaaa").ok).toBe(true);
    expect(validatePassword("12345678").ok).toBe(true);
  });
});
