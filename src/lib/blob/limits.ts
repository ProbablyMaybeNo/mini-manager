/**
 * Recipe-card phase 1 — shared validation limits for project model-photo
 * uploads. One source of truth for the client file-picker, the
 * `handleUpload` token route (server-enforced, so a tampered client can't
 * bypass these), and `recordProjectImage`'s per-project cap check.
 */

/** Accepted MIME types — matches the client `<input accept>` + server check. */
export const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/**
 * Pre-downscale cap on the file the browser hands to `upload()`. Generous —
 * a phone photo straight off the camera roll is often 4-8MB before any
 * client-side resize. Vercel Blob's own multipart path handles larger
 * files fine; this cap exists to keep a painter's project from silently
 * ballooning storage, not to route around the 4.5MB serverless body limit
 * — client uploads (browser → Blob directly) bypass that limit entirely.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Per-project-node cap on stored images (recipe-card phase 1 default). */
export const MAX_IMAGES_PER_PROJECT = 12;

/**
 * Client-side pre-flight check before handing a file to `upload()` — the
 * same rules are enforced server-side (the upload-token route's
 * `allowedContentTypes` / `maximumSizeInBytes`, which Vercel Blob itself
 * checks on the PUT), so this is purely a fast, friendly rejection before
 * spending a round-trip on a file that would fail anyway.
 */
export function validateImageFile(
  file: Pick<File, "type" | "size">,
): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_IMAGE_CONTENT_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number])) {
    return { ok: false, error: "Only PNG, JPEG, or WEBP images are supported." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Image is too large — max ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB.`,
    };
  }
  return { ok: true };
}
