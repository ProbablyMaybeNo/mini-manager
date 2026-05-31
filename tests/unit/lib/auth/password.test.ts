import { describe, expect, test } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("hashPassword + verifyPassword", () => {
  test("round-trips a plaintext password", async () => {
    const hash = await hashPassword("hunter22-letmein");
    expect(hash).not.toBe("hunter22-letmein");
    // bcrypt prefix: $2a$ / $2b$ / $2y$ depending on impl
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await verifyPassword("hunter22-letmein", hash)).toBe(true);
  });

  test("rejects a wrong password", async () => {
    const hash = await hashPassword("right-password-here");
    expect(await verifyPassword("wrong-password-here", hash)).toBe(false);
  });

  test("returns false for empty inputs", async () => {
    expect(await verifyPassword("", "$2a$10$xxxxxxxxxxxxxxxxxxxxxx")).toBe(false);
    expect(await verifyPassword("anything", "")).toBe(false);
  });

  test("returns false for a malformed hash without throwing", async () => {
    expect(await verifyPassword("anything", "not-a-bcrypt-hash")).toBe(false);
  });

  test("produces different hashes for the same plaintext (salting)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
    // Both still verify
    expect(await verifyPassword("same-password", a)).toBe(true);
    expect(await verifyPassword("same-password", b)).toBe(true);
  });
});
