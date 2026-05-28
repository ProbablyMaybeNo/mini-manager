/**
 * K-means colour clustering in RGB space.
 *
 * Used by the eyedropper tool to extract dominant colours from a
 * reference image. Pure functions — deterministic given a seeded RNG
 * (the public entry point hashes the input pixel buffer for the seed)
 * so the same image always yields the same palette. Unit-tested in
 * P4.8 against a synthetic three-block image.
 *
 * Implementation notes:
 *
 * - K-means++ initialisation (better starting centroids than uniform
 *   random; speeds convergence on natural images).
 * - At most 12 iterations — diminishing returns past that for colour
 *   clustering on photos.
 * - Sub-samples up to ~30k pixels via the seeded RNG so a 4-megapixel
 *   image doesn't lock the main thread. Random sampling avoids the
 *   bias systematic strides introduce (every-Nth-pixel over-weights
 *   the top of an image with a uniform sky).
 */

const DEFAULT_K = 6;
const MAX_ITERATIONS = 12;
const MAX_SAMPLES = 30_000;

export interface KmeansOptions {
  k?: number;
  maxIterations?: number;
  maxSamples?: number;
}

interface Centroid {
  r: number;
  g: number;
  b: number;
  count: number;
}

/**
 * Public entry: given an RGBA pixel buffer + image dims, return up to
 * `k` dominant colours sorted by cluster population (largest first).
 * Output is upper-case #RRGGBB hex.
 */
export function extractDominantColors(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  opts: KmeansOptions = {},
): string[] {
  const k = Math.max(1, opts.k ?? DEFAULT_K);
  const maxIter = opts.maxIterations ?? MAX_ITERATIONS;
  const maxSamples = opts.maxSamples ?? MAX_SAMPLES;
  const totalPixels = width * height;
  if (totalPixels === 0 || pixels.length < 4) return [];

  // Seed the RNG from a cheap hash of the buffer so the output is
  // deterministic per image — important for tests and for "same image
  // twice" feeling stable to the painter.
  const seed = hashBuffer(pixels);
  const rng = mulberry32(seed);

  const samples = collectSamples(pixels, totalPixels, maxSamples, rng);
  if (samples.length === 0) return [];

  const centroids = initCentroidsKmeansPP(samples, k, rng);
  const assignments = new Int32Array(samples.length / 3);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    // Assign each sample to the nearest centroid.
    for (let i = 0; i < assignments.length; i++) {
      const offset = i * 3;
      const r = samples[offset] ?? 0;
      const g = samples[offset + 1] ?? 0;
      const b = samples[offset + 2] ?? 0;
      let bestC = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const cen = centroids[c]!;
        const dr = r - cen.r;
        const dg = g - cen.g;
        const db = b - cen.b;
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) {
          bestD = d;
          bestC = c;
        }
      }
      if (assignments[i] !== bestC) {
        assignments[i] = bestC;
        changed = true;
      }
    }
    // Recompute centroids.
    const newCens: Centroid[] = centroids.map(() => ({
      r: 0,
      g: 0,
      b: 0,
      count: 0,
    }));
    for (let i = 0; i < assignments.length; i++) {
      const offset = i * 3;
      const c = assignments[i] ?? 0;
      const cen = newCens[c];
      if (!cen) continue;
      cen.r += samples[offset] ?? 0;
      cen.g += samples[offset + 1] ?? 0;
      cen.b += samples[offset + 2] ?? 0;
      cen.count++;
    }
    for (let c = 0; c < newCens.length; c++) {
      const cen = newCens[c]!;
      if (cen.count === 0) {
        // Keep the old centroid to avoid NaNs; the cluster is empty,
        // probably because two centroids collapsed onto the same point.
        const prev = centroids[c]!;
        cen.r = prev.r;
        cen.g = prev.g;
        cen.b = prev.b;
        cen.count = prev.count;
      } else {
        cen.r = cen.r / cen.count;
        cen.g = cen.g / cen.count;
        cen.b = cen.b / cen.count;
      }
    }
    for (let c = 0; c < centroids.length; c++) {
      centroids[c] = newCens[c]!;
    }
    if (!changed) break;
  }

  // Sort by population (largest cluster = most dominant).
  const sorted = [...centroids].sort((a, b) => b.count - a.count);
  return sorted.map(centroidToHex);
}

/* ============================================================
   Helpers
   ============================================================ */

function collectSamples(
  pixels: Uint8ClampedArray,
  totalPixels: number,
  maxSamples: number,
  rng: () => number,
): Uint8Array {
  // Skip near-transparent pixels — they're typically PNG padding.
  const targetCount = Math.min(totalPixels, maxSamples);
  const out = new Uint8Array(targetCount * 3);
  let written = 0;
  if (totalPixels <= maxSamples) {
    for (let i = 0; i < totalPixels && written < targetCount; i++) {
      const off = i * 4;
      const a = pixels[off + 3] ?? 0;
      if (a < 8) continue;
      out[written * 3] = pixels[off] ?? 0;
      out[written * 3 + 1] = pixels[off + 1] ?? 0;
      out[written * 3 + 2] = pixels[off + 2] ?? 0;
      written++;
    }
  } else {
    // Random subsample with a budget so we always fill exactly
    // targetCount slots (or fewer if too many alphas).
    let attempts = 0;
    const attemptCap = targetCount * 4;
    while (written < targetCount && attempts < attemptCap) {
      attempts++;
      const idx = Math.floor(rng() * totalPixels);
      const off = idx * 4;
      const a = pixels[off + 3] ?? 0;
      if (a < 8) continue;
      out[written * 3] = pixels[off] ?? 0;
      out[written * 3 + 1] = pixels[off + 1] ?? 0;
      out[written * 3 + 2] = pixels[off + 2] ?? 0;
      written++;
    }
  }
  if (written === targetCount) return out;
  return out.subarray(0, written * 3);
}

function initCentroidsKmeansPP(
  samples: Uint8Array,
  k: number,
  rng: () => number,
): Centroid[] {
  const sampleCount = samples.length / 3;
  if (sampleCount === 0) return [];
  const centroids: Centroid[] = [];
  // Pick the first centroid uniformly at random.
  const firstIdx = Math.floor(rng() * sampleCount);
  centroids.push(sampleAt(samples, firstIdx));

  const distances = new Float64Array(sampleCount);
  for (let i = 1; i < k; i++) {
    let total = 0;
    for (let p = 0; p < sampleCount; p++) {
      const r = samples[p * 3] ?? 0;
      const g = samples[p * 3 + 1] ?? 0;
      const b = samples[p * 3 + 2] ?? 0;
      let best = Infinity;
      for (const cen of centroids) {
        const dr = r - cen.r;
        const dg = g - cen.g;
        const db = b - cen.b;
        const d = dr * dr + dg * dg + db * db;
        if (d < best) best = d;
      }
      distances[p] = best;
      total += best;
    }
    if (total === 0) {
      // Degenerate: all samples are the same colour — pad the rest with
      // the first centroid so we still return k entries.
      centroids.push(centroids[0]!);
      continue;
    }
    let r = rng() * total;
    let pickedIdx = sampleCount - 1;
    for (let p = 0; p < sampleCount; p++) {
      r -= distances[p] ?? 0;
      if (r <= 0) {
        pickedIdx = p;
        break;
      }
    }
    centroids.push(sampleAt(samples, pickedIdx));
  }
  return centroids;
}

function sampleAt(samples: Uint8Array, idx: number): Centroid {
  const offset = idx * 3;
  return {
    r: samples[offset] ?? 0,
    g: samples[offset + 1] ?? 0,
    b: samples[offset + 2] ?? 0,
    count: 0,
  };
}

function centroidToHex(c: Centroid): string {
  const r = Math.round(c.r);
  const g = Math.round(c.g);
  const b = Math.round(c.b);
  return `#${clampByte(r).toString(16).padStart(2, "0")}${clampByte(g).toString(16).padStart(2, "0")}${clampByte(b).toString(16).padStart(2, "0")}`.toUpperCase();
}

function clampByte(n: number): number {
  if (n < 0) return 0;
  if (n > 255) return 255;
  return n;
}

/**
 * FNV-1a hash over a sparse sample of the pixel buffer. Used to seed
 * the RNG — we don't need cryptographic strength, just a stable 32-bit
 * value per image.
 */
function hashBuffer(buf: Uint8ClampedArray): number {
  let h = 0x811c9dc5;
  const step = Math.max(1, Math.floor(buf.length / 1024));
  for (let i = 0; i < buf.length; i += step) {
    h ^= buf[i] ?? 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: small, fast, deterministic seeded RNG. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
