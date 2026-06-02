/**
 * Hue-sort primitives for the Phase-16 heat-sink coverage grid.
 *
 * Pure functions, no React, no DB — unit-tested in the node env. The
 * grid reads as a smooth colour spectrum (reds → … → violets) with
 * desaturated near-greys parked in a neutral band at the *end* so a
 * pile of browns/greys doesn't scatter through the rainbow as noise.
 *
 * `hueSortedPaintIndex` is memoized module-side: the 7,144-paint sort
 * runs once per process and every request reuses the cached order.
 */
import type { Paint } from "./types";

export interface Hsl {
  /** Hue in degrees, 0–360. 0 for achromatic (grey) inputs. */
  h: number;
  /** Saturation, 0–1. */
  s: number;
  /** Lightness, 0–1. */
  l: number;
}

/**
 * Saturation below this (HSL `s`, 0–1) is treated as a near-grey and
 * sorted into the neutral band at the end of the spectrum rather than
 * scattered through it. Tuned against the real 7,144-paint catalog: at
 * 0.12 the spectrum stays clean (true colours keep their hue slot)
 * while the muddy browns / metallics / greys collect at the tail —
 * ~1.5k paints land in the neutral band, which matches the eyeball
 * read of "desaturated" on the actual swatches. Raising it pulls
 * muted-but-real earth tones (khakis, dusky purples) out of the
 * spectrum; lowering it lets grimy metallics speckle the rainbow.
 */
export const NEUTRAL_SATURATION_THRESHOLD = 0.12;

/**
 * Parse `#rgb` / `#rrggbb` (with or without leading `#`) to [r,g,b]
 * 0–255. Returns null on anything that doesn't parse so callers can
 * float garbage hexes to the end deterministically.
 */
function parseHexBytes(hex: string): [number, number, number] | null {
  if (!hex) return null;
  const s = (hex.startsWith("#") ? hex.slice(1) : hex).trim();
  let body: string;
  if (s.length === 3) {
    body = s
      .split("")
      .map((c) => c + c)
      .join("");
  } else if (s.length === 6) {
    body = s;
  } else {
    return null;
  }
  const r = parseInt(body.slice(0, 2), 16);
  const g = parseInt(body.slice(2, 4), 16);
  const b = parseInt(body.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

/**
 * Standard sRGB → HSL conversion. Achromatic inputs (r === g === b)
 * return `{ h: 0, s: 0, l }`. Returns null when the hex doesn't parse.
 */
export function hexToHsl(hex: string): Hsl | null {
  const rgb = parseHexBytes(hex);
  if (!rgb) return null;
  const rn = rgb[0] / 255;
  const gn = rgb[1] / 255;
  const bn = rgb[2] / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    return { h: 0, s: 0, l };
  }
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

/**
 * The comparable sort key for a single paint. Two-tier:
 *
 *   - **Chromatic** paints (`s >= NEUTRAL_SATURATION_THRESHOLD`) sort
 *     by hue, then saturation, then lightness — same-hue paints ramp
 *     pale→vivid then light→dark.
 *   - **Near-grey** paints (`s < threshold`, or an unparseable hex)
 *     sort into a neutral band *after* every chromatic paint, ordered
 *     by lightness (dark → light).
 *
 * Returned as a flat tuple so callers compare lexically. `band` is the
 * coarse partition (0 = spectrum, 1 = neutral) and dominates.
 */
export interface HueSortKey {
  band: 0 | 1;
  h: number;
  s: number;
  l: number;
}

export function hueSortKey(paint: Paint): HueSortKey {
  const hsl = hexToHsl(paint.hex);
  if (!hsl) {
    // Unparseable hex → very end of the neutral band.
    return { band: 1, h: 0, s: 0, l: Number.POSITIVE_INFINITY };
  }
  if (hsl.s < NEUTRAL_SATURATION_THRESHOLD) {
    return { band: 1, h: 0, s: hsl.s, l: hsl.l };
  }
  return { band: 0, h: hsl.h, s: hsl.s, l: hsl.l };
}

/** Lexical compare of two hue-sort keys. */
export function compareHueSortKey(a: HueSortKey, b: HueSortKey): number {
  if (a.band !== b.band) return a.band - b.band;
  if (a.h !== b.h) return a.h - b.h;
  if (a.s !== b.s) return a.s - b.s;
  if (a.l !== b.l) return a.l - b.l;
  return 0;
}

/** Stable hue-sorted copy of `paints` (does not mutate the input). */
export function hueSortPaints(paints: readonly Paint[]): Paint[] {
  const keyed = paints.map((p, i) => ({ p, i, k: hueSortKey(p) }));
  keyed.sort((x, y) => {
    const c = compareHueSortKey(x.k, y.k);
    // Tie-break on original index for a stable, deterministic order.
    return c !== 0 ? c : x.i - y.i;
  });
  return keyed.map((e) => e.p);
}

/**
 * Module-side memoized hue-sorted index. The catalog is a static asset
 * that never changes within a process, so we sort the array identity
 * once and hand back the cached result on every subsequent call. A
 * different array identity (e.g. a fresh load, or a filtered subset)
 * invalidates the cache and re-sorts.
 */
let cachedInput: readonly Paint[] | null = null;
let cachedOutput: Paint[] | null = null;

export function hueSortedPaintIndex(paints: readonly Paint[]): Paint[] {
  if (cachedInput === paints && cachedOutput) return cachedOutput;
  const sorted = hueSortPaints(paints);
  cachedInput = paints;
  cachedOutput = sorted;
  return sorted;
}

/** Test-only: drop the memoized index so a fresh sort runs. */
export function _resetHueIndexCache(): void {
  cachedInput = null;
  cachedOutput = null;
}
