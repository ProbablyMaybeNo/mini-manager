import { describe, expect, test } from "vitest";
import {
  generatePublicSlug,
  PUBLIC_SLUG_ALPHABET,
  PUBLIC_SLUG_LENGTH,
} from "@/lib/recipes/slug";

describe("generatePublicSlug", () => {
  test("returns a string of the configured length", () => {
    const slug = generatePublicSlug();
    expect(slug).toHaveLength(PUBLIC_SLUG_LENGTH);
    expect(PUBLIC_SLUG_LENGTH).toBe(10);
  });

  test("every character is in the custom alphabet (no 0/1/l, no uppercase)", () => {
    const allowed = new Set(PUBLIC_SLUG_ALPHABET);
    // Banned characters per the plan: ambiguous digits and uppercase
    // misreads. Lowercase i + o are kept (alphabet `abcdefghijkmnopqrstuvwxyz23456789`).
    for (const banned of ["0", "1", "l", "I", "L", "O"]) {
      expect(allowed.has(banned)).toBe(false);
    }
    for (let i = 0; i < 200; i++) {
      const slug = generatePublicSlug();
      for (const ch of slug) {
        expect(allowed.has(ch)).toBe(true);
      }
    }
  });

  test("100 iterations produce 100 distinct slugs", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generatePublicSlug());
    expect(seen.size).toBe(100);
  });

  test("no two consecutive calls match", () => {
    for (let i = 0; i < 100; i++) {
      expect(generatePublicSlug()).not.toBe(generatePublicSlug());
    }
  });
});
