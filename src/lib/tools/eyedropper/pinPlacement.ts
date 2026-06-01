/**
 * P12.15 — Helpers for placing eyedropper pins on a sampled image.
 *
 * The eyedropper tool extracts up to 6 dominant colours via k-means
 * (existing kmeans.ts helper). Each colour gets a draggable "pin"
 * overlaid on the image — the pin's position SAMPLES the pixel under
 * it. To make the initial pin placement feel meaningful, we walk the
 * image once and find the pixel closest (by RGB distance) to each
 * extracted colour. Each pin claims the centroid of every pixel that
 * scored it.
 *
 * Pure functions; no DOM access. Caller provides the SampledImage
 * (width / height / RGBA buffer) + the extracted hex list.
 */

import type { SampledImage } from "./sample";

export interface PinPlacement {
  /** Image-space x (px). */
  x: number;
  /** Image-space y (px). */
  y: number;
  /** Sampled hex at (x, y). */
  hex: string;
}

function parseHex(hex: string): [number, number, number] | null {
  const s = hex.startsWith("#") ? hex.slice(1) : hex;
  if (s.length !== 6) return null;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

function rgbDistanceSq(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * For each hex in `hexes`, return the (x, y) of the image pixel
 * closest to it in RGB space. Walks the image with a stride to keep
 * the cost bounded on 4k photos (still hits every cluster). Returns
 * placements in the same order as `hexes` — malformed input hexes
 * are skipped.
 */
export function placePins(
  image: SampledImage,
  hexes: ReadonlyArray<string>,
): PinPlacement[] {
  if (hexes.length === 0) return [];
  const targets = hexes.map(parseHex);
  // Best-so-far per target.
  const best: (PinPlacement & { distance: number } | null)[] = targets.map(
    () => null,
  );

  // Stride keeps a 4-MP image to ~100k samples — fast enough on main
  // thread, dense enough to land near a cluster centroid in practice.
  const totalPixels = image.width * image.height;
  const stride = Math.max(1, Math.floor(totalPixels / 100_000));

  for (let i = 0; i < totalPixels; i += stride) {
    const idx = i * 4;
    const r = image.pixels[idx] ?? 0;
    const g = image.pixels[idx + 1] ?? 0;
    const b = image.pixels[idx + 2] ?? 0;
    const a = image.pixels[idx + 3] ?? 255;
    if (a < 128) continue; // skip transparent pixels
    for (let t = 0; t < targets.length; t++) {
      const target = targets[t];
      if (!target) continue;
      const d = rgbDistanceSq([r, g, b], target);
      const current = best[t];
      if (!current || d < current.distance) {
        const x = i % image.width;
        const y = Math.floor(i / image.width);
        const hexOut = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
        best[t] = { x, y, hex: hexOut, distance: d };
      }
    }
  }

  const out: PinPlacement[] = [];
  for (const placement of best) {
    if (placement) {
      out.push({ x: placement.x, y: placement.y, hex: placement.hex });
    }
  }
  return out;
}
