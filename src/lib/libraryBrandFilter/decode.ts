/**
 * P12.19 — Pure decoder for the JSON-encoded user.library_brand_filter
 * column. Lives in its own module (NOT a 'use server' file) so the
 * server-action module can stay locked to async-only exports.
 *
 * Returns null when the input is empty, malformed, or not an array.
 * Null = "no filter" — the /library page interprets null as "all
 * brands visible".
 */
export function decodeLibraryBrandFilter(
  encoded: string | null | undefined,
): string[] | null {
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(encoded);
    if (!Array.isArray(parsed)) return null;
    const out: string[] = [];
    for (const value of parsed) {
      if (typeof value === "string" && value.length > 0) out.push(value);
    }
    return out;
  } catch {
    return null;
  }
}
