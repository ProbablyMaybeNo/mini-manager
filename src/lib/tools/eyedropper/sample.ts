/**
 * Image-to-pixels helper. Decodes a Blob into a flat Uint8ClampedArray
 * of RGBA pixels via `createImageBitmap` + offscreen canvas (with a
 * <canvas> fallback for older Safari that lacks OffscreenCanvas). Caps
 * the long edge so even huge phone photos decode in milliseconds.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export interface SampledImage {
  width: number;
  height: number;
  /** RGBA in row-major order, length = width * height * 4. */
  pixels: Uint8ClampedArray;
}

export interface SampleOptions {
  /** Longest-edge cap. Image is scaled (preserving aspect) before
   *  pixel extraction. Default 512px — enough resolution for k-means
   *  to find dominant colours, small enough to decode fast. */
  maxEdge?: number;
}

/**
 * Validate a candidate file/blob before decoding. Returns the error
 * message a caller can render, or null when the file passes.
 */
export function validateImageBlob(blob: Blob): string | null {
  if (blob.size > MAX_FILE_BYTES) {
    return "Image is larger than 10 MB. Please use a smaller file.";
  }
  if (blob.type && !ALLOWED_MIME_TYPES.has(blob.type)) {
    return "Unsupported image type. Use JPG, PNG, WebP, or GIF.";
  }
  return null;
}

/**
 * Decode a blob to RGBA pixels. Browser-only — the eyedropper tool is
 * client-rendered, so we don't need a node fallback.
 */
export async function imageToPixels(
  blob: Blob,
  opts: SampleOptions = {},
): Promise<SampledImage> {
  const maxEdge = opts.maxEdge ?? 512;
  const bitmap = await createImageBitmap(blob);
  try {
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    if (typeof OffscreenCanvas !== "undefined") {
      const offscreen = new OffscreenCanvas(w, h);
      const ctx = offscreen.getContext("2d");
      if (!ctx) throw new Error("Couldn't acquire 2D context");
      ctx.drawImage(bitmap, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      return { width: w, height: h, pixels: img.data };
    }
    // Fallback: regular canvas.
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't acquire 2D context");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    return { width: w, height: h, pixels: img.data };
  } finally {
    bitmap.close?.();
  }
}

/**
 * Sample a single pixel's hex from a decoded image at (x, y). Used by
 * the "click on the preview to add a swatch" interaction. Coordinates
 * are clamped to the image bounds.
 */
export function samplePixelHex(image: SampledImage, x: number, y: number): string {
  const cx = Math.max(0, Math.min(image.width - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(image.height - 1, Math.round(y)));
  const idx = (cy * image.width + cx) * 4;
  const r = image.pixels[idx] ?? 0;
  const g = image.pixels[idx + 1] ?? 0;
  const b = image.pixels[idx + 2] ?? 0;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
}
