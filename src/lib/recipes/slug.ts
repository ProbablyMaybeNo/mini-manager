import { customAlphabet } from "nanoid";

/**
 * Custom 33-char alphabet for public recipe slugs.
 *
 * Excludes ambiguous characters that get misread when a friend types
 * the URL off a screenshot or copies it from a QR scan glitch:
 *
 *   - digit `0` (confused with uppercase O)
 *   - digit `1` (confused with lowercase l)
 *   - lowercase `l` (confused with digit 1)
 *
 * Resulting set: a-z minus `l` (25 letters) + digits 2-9 (8 digits) =
 * 33 chars. Length 10 → 33^10 ≈ 1.5×10^15 combinations. Plenty for v1.
 *
 * Slug URLs render as lowercase only, so uppercase confusables (I/O/L)
 * never reach the alphabet to begin with.
 */
const SLUG_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

export const PUBLIC_SLUG_ALPHABET = SLUG_ALPHABET;
export const PUBLIC_SLUG_LENGTH = 10;

const generator = customAlphabet(SLUG_ALPHABET, PUBLIC_SLUG_LENGTH);

/**
 * Mint a 10-character URL-safe slug for a public recipe URL. Uses
 * an unambiguous-character alphabet (see `SLUG_ALPHABET`). Collisions
 * are vanishingly rare at this keyspace, but the calling action retries
 * on unique-index failure just in case.
 */
export function generatePublicSlug(): string {
  return generator();
}
