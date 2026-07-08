/**
 * Lab-space colour ramp builder. Given a base + shadow + highlight, the
 * shadow sits at the left, the base anchors the middle, and the
 * highlight pins the right. We interpolate each half in Lab so the ramp
 * is perceptually even (RGB interpolation darkens mid-tones).
 *
 * Pure functions. Reuses `hexToLab` from `lib/tools/match/deltaE.ts`.
 * Unit-tested in P4.8.
 */

import {
  hexToLab,
  type LabColor,
} from "@/lib/tools/match/deltaE";

export const MIN_STEPS = 3;
export const MAX_STEPS = 7;

export interface BuildRampInput {
  /** Mid-tone — the painter's main colour. Anchors the centre. */
  base: string;
  /** Darker variant — anchors the left end. */
  shadow: string;
  /** Lighter variant — anchors the right end. */
  highlight: string;
  /** 3 ≤ steps ≤ 7. Clamped on entry. */
  steps: number;
}

/**
 * Build an N-step ramp in Lab. Output is upper-case #RRGGBB hex,
 * shadow-to-highlight, with the base falling at the middle index.
 * Returns an empty array if any input fails to parse.
 *
 * Layout — odd N centres the base; even N still includes the base
 * exactly (it's the midpoint of the shadow-base + base-highlight
 * halves) but the centre of the array sits between two interpolated
 * steps:
 *
 *   steps=3 → [shadow, base, highlight]
 *   steps=4 → [shadow, mid(shadow,base), mid(base,highlight), highlight]
 *             (base itself is the join point at index 1.5)
 *   steps=5 → [shadow, half-shadow, base, half-highlight, highlight]
 *   steps=7 → 3 shadow→base interpolations + base + 3 base→highlight
 *
 * Acceptance: increasing the step count never shifts the *visual*
 * positions of shadow / base / highlight — they remain anchored.
 */
export function buildRamp(input: BuildRampInput): string[] {
  const steps = clampInt(input.steps, MIN_STEPS, MAX_STEPS);
  const shadowLab = hexToLab(input.shadow);
  const baseLab = hexToLab(input.base);
  const highlightLab = hexToLab(input.highlight);
  if (!shadowLab || !baseLab || !highlightLab) return [];

  // Strategy:
  // - The shadow + highlight always pin index 0 and N-1.
  // - The base is centred when N is odd (index = (N-1)/2).
  //   For even N, we still place the base exactly in the array — at
  //   index floor((N-1)/2) — and interpolate the two halves around it.
  //   This makes "the base is the middle paint" easy to read in the UI
  //   and matches the painter's expectation.
  const out = new Array<LabColor | null>(steps).fill(null);
  out[0] = shadowLab;
  out[steps - 1] = highlightLab;
  const baseIndex = Math.floor((steps - 1) / 2);
  out[baseIndex] = baseLab;

  // Interpolate the shadow→base half.
  if (baseIndex > 1) {
    for (let i = 1; i < baseIndex; i++) {
      const t = i / baseIndex;
      out[i] = lerp(shadowLab, baseLab, t);
    }
  }
  // Interpolate the base→highlight half.
  const rightSpan = steps - 1 - baseIndex;
  if (rightSpan > 1) {
    for (let i = 1; i < rightSpan; i++) {
      const t = i / rightSpan;
      out[baseIndex + i] = lerp(baseLab, highlightLab, t);
    }
  }

  return out.map((lab) => labToHex(lab));
}

/* ============================================================
   Helpers — Lab interpolation + Lab → hex.
   ============================================================ */

/** Lab-space linear interpolation — exported so other Lab-space derivations
 *  (the LAYERING MATCH button's seed→derive math) reuse the ramp's own
 *  interpolation instead of re-deriving it. */
export function lerp(a: LabColor, b: LabColor, t: number): LabColor {
  return {
    L: a.L + (b.L - a.L) * t,
    a: a.a + (b.a - a.a) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function clampInt(n: number, min: number, max: number): number {
  const v = Math.round(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/* ============================================================
   Lab → sRGB hex. Inverse of the deltaE pipeline.
   ============================================================ */

const D65 = { X: 0.95047, Y: 1.0, Z: 1.08883 } as const;

/** Lab → hex, exported for the same reuse reason as {@link lerp}. */
export function labToHex(lab: LabColor | null): string {
  if (!lab) return "#000000";
  const xyz = labToXyz(lab);
  const rgb = xyzToSrgb(xyz.X, xyz.Y, xyz.Z);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function labToXyz(lab: LabColor): { X: number; Y: number; Z: number } {
  const fy = (lab.L + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;
  const e = 216 / 24389;
  const k = 24389 / 27;
  const fxCubed = fx * fx * fx;
  const fzCubed = fz * fz * fz;
  const yr = lab.L > 8 ? Math.pow(fy, 3) : lab.L / k;
  const xr = fxCubed > e ? fxCubed : (116 * fx - 16) / k;
  const zr = fzCubed > e ? fzCubed : (116 * fz - 16) / k;
  return { X: xr * D65.X, Y: yr * D65.Y, Z: zr * D65.Z };
}

function xyzToSrgb(X: number, Y: number, Z: number): {
  r: number;
  g: number;
  b: number;
} {
  const rLin = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  const gLin = X * -0.969266 + Y * 1.8760108 + Z * 0.041556;
  const bLin = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;
  return {
    r: srgbCompand(rLin),
    g: srgbCompand(gLin),
    b: srgbCompand(bLin),
  };
}

function srgbCompand(linear: number): number {
  const c = clamp01(linear);
  return c <= 0.0031308
    ? 12.92 * c
    : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function rgbToHex(r01: number, g01: number, b01: number): string {
  const toByte = (c: number) => {
    const v = Math.round(clamp01(c) * 255);
    return v.toString(16).padStart(2, "0");
  };
  return `#${toByte(r01)}${toByte(g01)}${toByte(b01)}`.toUpperCase();
}
