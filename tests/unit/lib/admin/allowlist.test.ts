import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { isAdminUser } from "@/lib/admin/allowlist";

/**
 * E3 — the admin allowlist must FAIL CLOSED. No hard-coded fallback email, and
 * admin requires a VERIFIED email so an unverified (freely user-settable)
 * address can never open the gallery-moderation gate.
 */

const verified = new Date("2026-01-01T00:00:00Z");

let savedEnv: string | undefined;

beforeEach(() => {
  savedEnv = process.env.MM_ADMIN_EMAILS;
  delete process.env.MM_ADMIN_EMAILS;
});

afterEach(() => {
  if (savedEnv === undefined) {
    delete process.env.MM_ADMIN_EMAILS;
  } else {
    process.env.MM_ADMIN_EMAILS = savedEnv;
  }
});

describe("isAdminUser — fail closed when MM_ADMIN_EMAILS is unset", () => {
  test("unset env ⇒ nobody is admin, even a verified email", () => {
    expect(
      isAdminUser({ email: "someone@example.com", emailVerified: verified }),
    ).toBe(false);
  });

  test("empty / whitespace env ⇒ nobody is admin", () => {
    process.env.MM_ADMIN_EMAILS = "   ";
    expect(
      isAdminUser({ email: "someone@example.com", emailVerified: verified }),
    ).toBe(false);
  });
});

describe("isAdminUser — requires both allowlist membership and a verified email", () => {
  beforeEach(() => {
    process.env.MM_ADMIN_EMAILS = "admin@example.com, second@example.com";
  });

  test("a verified allowlisted email is admin", () => {
    expect(
      isAdminUser({ email: "admin@example.com", emailVerified: verified }),
    ).toBe(true);
  });

  test("a matching but UNVERIFIED email is not admin", () => {
    expect(
      isAdminUser({ email: "admin@example.com", emailVerified: null }),
    ).toBe(false);
    expect(
      isAdminUser({ email: "admin@example.com", emailVerified: undefined }),
    ).toBe(false);
  });

  test("a verified email NOT on the allowlist is not admin", () => {
    expect(
      isAdminUser({ email: "intruder@example.com", emailVerified: verified }),
    ).toBe(false);
  });

  test("matching is case- and whitespace-insensitive", () => {
    expect(
      isAdminUser({ email: "  Admin@Example.COM ", emailVerified: verified }),
    ).toBe(true);
    expect(
      isAdminUser({ email: "SECOND@example.com", emailVerified: verified }),
    ).toBe(true);
  });

  test("no email / null user is not admin", () => {
    expect(isAdminUser({ email: null, emailVerified: verified })).toBe(false);
    expect(isAdminUser({ email: undefined, emailVerified: verified })).toBe(false);
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
  });
});
