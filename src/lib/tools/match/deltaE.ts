/**
 * Colour-difference primitives for the cross-brand match + wheel tools.
 *
 * - `hexToRgb01` / `rgbToXyz` / `xyzToLab`: sRGB → XYZ (D65) → Lab.
 * - `hexToLab`: convenience wrapper.
 * - `deltaE2000`: CIEDE2000 (Sharma et al., 2005) — the perceptual
 *   distance metric used everywhere in Phase 4.
 *
 * Pure functions. No external colour libraries (V2-BUILD-PLAN tight
 * surface rule). Unit-tested against the published CIEDE2000 reference
 * pairs in P4.8.
 */

export interface LabColor {
  L: number;
  a: number;
  b: number;
}

/* ============================================================
   sRGB → Lab (D65)
   ============================================================ */

const D65 = { X: 0.95047, Y: 1.0, Z: 1.08883 } as const;

function srgbCompand(channel: number): number {
  // Inverse sRGB companding to linear-light.
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function labCompand(t: number): number {
  // Lab nonlinearity (used after dividing by reference white).
  const e = 216 / 24389; // 0.008856…
  const k = 24389 / 27; // 903.3…
  return t > e ? Math.cbrt(t) : (k * t + 16) / 116;
}

export function hexToRgb01(hex: string): { r: number; g: number; b: number } | null {
  const trimmed = hex.trim();
  const m =
    /^#?([0-9a-fA-F]{3})$/.exec(trimmed) ??
    /^#?([0-9a-fA-F]{6})$/.exec(trimmed);
  const body = m?.[1];
  if (!body) return null;
  let r: number;
  let g: number;
  let b: number;
  if (body.length === 3) {
    const c0 = body.charAt(0);
    const c1 = body.charAt(1);
    const c2 = body.charAt(2);
    r = parseInt(c0 + c0, 16);
    g = parseInt(c1 + c1, 16);
    b = parseInt(c2 + c2, 16);
  } else {
    r = parseInt(body.slice(0, 2), 16);
    g = parseInt(body.slice(2, 4), 16);
    b = parseInt(body.slice(4, 6), 16);
  }
  return { r: r / 255, g: g / 255, b: b / 255 };
}

export function rgbToXyz(r: number, g: number, b: number): {
  X: number;
  Y: number;
  Z: number;
} {
  const R = srgbCompand(r);
  const G = srgbCompand(g);
  const B = srgbCompand(b);
  // sRGB → XYZ matrix (D65).
  return {
    X: R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
    Y: R * 0.2126729 + G * 0.7151522 + B * 0.072175,
    Z: R * 0.0193339 + G * 0.119192 + B * 0.9503041,
  };
}

export function xyzToLab(X: number, Y: number, Z: number): LabColor {
  const fx = labCompand(X / D65.X);
  const fy = labCompand(Y / D65.Y);
  const fz = labCompand(Z / D65.Z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function hexToLab(hex: string): LabColor | null {
  const rgb = hexToRgb01(hex);
  if (!rgb) return null;
  const xyz = rgbToXyz(rgb.r, rgb.g, rgb.b);
  return xyzToLab(xyz.X, xyz.Y, xyz.Z);
}

/* ============================================================
   CIEDE2000 — Sharma, Wu, Dalal (2005). Reference-pair tested.
   ============================================================ */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function deltaE2000(a: LabColor, b: LabColor): number {
  const L1 = a.L;
  const A1 = a.a;
  const B1 = a.b;
  const L2 = b.L;
  const A2 = b.a;
  const B2 = b.b;

  const avgLp = (L1 + L2) / 2;
  const C1 = Math.sqrt(A1 * A1 + B1 * B1);
  const C2 = Math.sqrt(A2 * A2 + B2 * B2);
  const avgC = (C1 + C2) / 2;

  const G =
    0.5 *
    (1 -
      Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));

  const a1p = (1 + G) * A1;
  const a2p = (1 + G) * A2;

  const C1p = Math.sqrt(a1p * a1p + B1 * B1);
  const C2p = Math.sqrt(a2p * a2p + B2 * B2);
  const avgCp = (C1p + C2p) / 2;

  const h1p = hueDegrees(B1, a1p);
  const h2p = hueDegrees(B2, a2p);

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * DEG);

  let avgHp: number;
  if (C1p * C2p === 0) {
    avgHp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    avgHp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    avgHp = (h1p + h2p + 360) / 2;
  } else {
    avgHp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos((avgHp - 30) * DEG) +
    0.24 * Math.cos(2 * avgHp * DEG) +
    0.32 * Math.cos((3 * avgHp + 6) * DEG) -
    0.2 * Math.cos((4 * avgHp - 63) * DEG);

  const dTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
  const Rc =
    2 *
    Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const Sl =
    1 +
    (0.015 * Math.pow(avgLp - 50, 2)) /
      Math.sqrt(20 + Math.pow(avgLp - 50, 2));
  const Sc = 1 + 0.045 * avgCp;
  const Sh = 1 + 0.015 * avgCp * T;
  const Rt = -Math.sin(2 * dTheta * DEG) * Rc;

  const kL = 1;
  const kC = 1;
  const kH = 1;

  return Math.sqrt(
    Math.pow(dLp / (kL * Sl), 2) +
      Math.pow(dCp / (kC * Sc), 2) +
      Math.pow(dHp / (kH * Sh), 2) +
      Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh)),
  );
}

function hueDegrees(b: number, ap: number): number {
  if (b === 0 && ap === 0) return 0;
  const deg = Math.atan2(b, ap) * RAD;
  return deg >= 0 ? deg : deg + 360;
}

/**
 * High-level convenience: ΔE2000 between two hex strings. Returns
 * Infinity when either input doesn't parse — sorted-ascending callers
 * therefore push parse failures to the bottom of the list.
 */
export function deltaE2000Hex(hex1: string, hex2: string): number {
  const a = hexToLab(hex1);
  const b = hexToLab(hex2);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return deltaE2000(a, b);
}
