/**
 * Shared limits for the "Scan paints from a photo" feature — used by the
 * client file-picker (fast, friendly pre-flight rejection) AND the vision
 * call in `src/lib/ai/paintScan.ts` (the real, unbypassable enforcement).
 * Deliberately NOT `server-only` — the client component imports this
 * directly, same split as `src/lib/blob/limits.ts` for project photos.
 */

/** Accepted MIME types for a scanned photo — matches the client
 *  `<input accept>` and the vision call's supported image types. */
export const SCAN_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ScanImageMediaType = (typeof SCAN_ACCEPTED_TYPES)[number];

/** Anthropic's vision endpoint rejects images much past this — reject
 *  client-side before spending a round-trip on a call that would fail. */
export const MAX_SCAN_IMAGE_BYTES = 5 * 1024 * 1024;

export function isScanImageMediaType(value: string): value is ScanImageMediaType {
  return (SCAN_ACCEPTED_TYPES as readonly string[]).includes(value);
}

/** Client-side pre-flight check before reading + posting the photo. The
 *  server re-checks media type and size independently — this is purely a
 *  fast, friendly rejection. */
export function validateScanImageFile(
  file: Pick<File, "type" | "size">,
): { ok: true } | { ok: false; error: string } {
  if (!isScanImageMediaType(file.type)) {
    return { ok: false, error: "Only PNG, JPEG, or WEBP photos are supported." };
  }
  if (file.size > MAX_SCAN_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Photo is too large — max ${Math.floor(MAX_SCAN_IMAGE_BYTES / (1024 * 1024))}MB.`,
    };
  }
  return { ok: true };
}
