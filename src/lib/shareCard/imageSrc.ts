/**
 * Recipe-card phase 2 — export-safe image sourcing.
 *
 * Model photos live on Vercel Blob (`*.public.blob.vercel-storage.com`), a
 * cross-origin host. `html-to-image` inlines every `<img>` it finds as a
 * base64 data URI by fetching it in-browser before rastering the canvas; if
 * that fetch can't complete (missing/absent CORS headers on the remote
 * response), the resulting canvas is tainted and the PNG export throws.
 * Routing the blob URL through our own `/api/blob-proxy` makes the fetch
 * same-origin, sidestepping the third-party host's CORS story entirely.
 *
 * Local picks (an object URL from the browser's own file input) and any
 * other same-origin asset pass through unchanged — only the blob host is
 * rewritten.
 */

const PROXIED_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/** True for an https URL on the Vercel Blob public-storage host. */
export function isProxiableBlobUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && parsed.hostname.endsWith(PROXIED_HOST_SUFFIX);
}

/**
 * The URL to actually put in the card's `<img src>` for export — proxied
 * for Blob-hosted photos, unchanged for everything else (object: URLs from
 * a local file pick, data: URIs, same-origin paths).
 */
export function exportableImageSrc(url: string): string {
  return isProxiableBlobUrl(url) ? `/api/blob-proxy?url=${encodeURIComponent(url)}` : url;
}
