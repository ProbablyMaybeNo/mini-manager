/**
 * Vercel Blob environment variable read.
 *
 * Recipe-card phase 1 — the Blob store is provisioned in the Vercel
 * dashboard out-of-band (Ross), so `BLOB_READ_WRITE_TOKEN` may not exist
 * yet in every environment. Mirrors `src/lib/billing/env.ts`: the read
 * never throws at module load, so importing `@/lib/blob/*` from a route
 * handler or server action is always safe. Callers that actually need to
 * talk to Blob (the upload-token route, `deleteProjectImage`) check
 * `isBlobConfigured()` first and return a clean, handled error instead of
 * letting the Blob SDK throw past them.
 */
export function blobReadWriteToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

export function isBlobConfigured(): boolean {
  return blobReadWriteToken() !== null;
}
