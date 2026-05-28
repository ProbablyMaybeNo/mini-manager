/**
 * Eight pure colour-harmony generators. Given a primary HSL pick, each
 * returns an ordered list of hex strings — the primary first, then the
 * derived swatches at fixed hue offsets. Saturation + lightness are
 * inherited from the primary unless the harmony explicitly varies them
 * (monochromatic walks lightness; everything else holds it constant).
 *
 * These functions are stateless and deterministic — perfect for unit
 * tests (P4.8). All hex output is upper-case #RRGGBB so equality checks
 * in the UI and tests don't have to fight case.
 */

export const harmonyKeys = [
  "complementary",
  "analogous",
  "triadic",
  "tetradic",
  "splitComplementary",
  "square",
  "monochromatic",
  "accentedAnalogous",
] as const;
export type HarmonyKey = (typeof harmonyKeys)[number];

export interface HarmonyMeta {
  key: HarmonyKey;
  label: string;
  /** Short hint that surfaces in the harmony picker. */
  description: string;
  /** Number of swatches this harmony produces. */
  swatchCount: number;
}

export const HARMONIES: ReadonlyArray<HarmonyMeta> = [
  {
    key: "complementary",
    label: "Complementary",
    description: "Primary + opposite — high contrast",
    swatchCount: 2,
  },
  {
    key: "analogous",
    label: "Analogous",
    description: "Three neighbours — natural, harmonious",
    swatchCount: 3,
  },
  {
    key: "triadic",
    label: "Triadic",
    description: "Three evenly spaced hues",
    swatchCount: 3,
  },
  {
    key: "tetradic",
    label: "Tetradic",
    description: "Rectangle on the wheel — two complementary pairs",
    swatchCount: 4,
  },
  {
    key: "splitComplementary",
    label: "Split-comp.",
    description: "Primary + two flanking complements",
    swatchCount: 3,
  },
  {
    key: "square",
    label: "Square",
    description: "Four equally spaced hues",
    swatchCount: 4,
  },
  {
    key: "monochromatic",
    label: "Monochromatic",
    description: "Same hue, varied lightness",
    swatchCount: 5,
  },
  {
    key: "accentedAnalogous",
    label: "Accented analogous",
    description: "Three neighbours + complement accent",
    swatchCount: 4,
  },
];

export function getHarmonyMeta(key: HarmonyKey): HarmonyMeta {
  // The table is a literal constant — find never returns undefined here,
  // but we widen for safety.
  const found = HARMONIES.find((h) => h.key === key);
  if (!found) {
    throw new Error(`Unknown harmony: ${key}`);
  }
  return found;
}

/* ============================================================
   HSL ↔ hex (inline; no external colour lib per V2-BUILD-PLAN)
   ============================================================ */

export function clampHue(h: number): number {
  let v = h % 360;
  if (v < 0) v += 360;
  return v;
}

/**
 * HSL → #RRGGBB. h in degrees [0,360); s, l in percent [0,100].
 *
 * Implementation: the canonical "k = (n + h/30) mod 12" formulation —
 * keeps the maths small and bypasses the chroma/X/m intermediate
 * variables. Output is upper-cased so equality is easy.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const H = clampHue(h);
  const S = clamp01(s / 100);
  const L = clamp01(l / 100);
  const a = S * Math.min(L, 1 - L);
  const channel = (n: number): number => {
    const k = (n + H / 30) % 12;
    return L - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return `#${toHex(channel(0))}${toHex(channel(8))}${toHex(channel(4))}`.toUpperCase();
}

/**
 * #RGB / #RRGGBB → HSL. Returns null when the input doesn't match the
 * expected hex shape — callers MUST handle null (typically by leaving
 * the picker on its default).
 */
export function hexToHsl(
  hex: string,
): { h: number; s: number; l: number } | null {
  const normalised = normaliseHex(hex);
  if (!normalised) return null;
  const r = parseInt(normalised.slice(1, 3), 16) / 255;
  const g = parseInt(normalised.slice(3, 5), 16) / 255;
  const b = parseInt(normalised.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

/* ============================================================
   Harmony generators — every signature returns hex[] in
   the order [primary, ...derived].
   ============================================================ */

export function complementary(h: number, s: number, l: number): string[] {
  return [hslToHex(h, s, l), hslToHex(h + 180, s, l)];
}

export function analogous(
  h: number,
  s: number,
  l: number,
  spread = 30,
): string[] {
  return [
    hslToHex(h, s, l),
    hslToHex(h - spread, s, l),
    hslToHex(h + spread, s, l),
  ];
}

export function triadic(h: number, s: number, l: number): string[] {
  return [hslToHex(h, s, l), hslToHex(h + 120, s, l), hslToHex(h + 240, s, l)];
}

export function tetradic(
  h: number,
  s: number,
  l: number,
  angle = 60,
): string[] {
  return [
    hslToHex(h, s, l),
    hslToHex(h + angle, s, l),
    hslToHex(h + 180, s, l),
    hslToHex(h + 180 + angle, s, l),
  ];
}

export function splitComplementary(
  h: number,
  s: number,
  l: number,
  spread = 30,
): string[] {
  return [
    hslToHex(h, s, l),
    hslToHex(h + 180 - spread, s, l),
    hslToHex(h + 180 + spread, s, l),
  ];
}

export function square(h: number, s: number, l: number): string[] {
  return [
    hslToHex(h, s, l),
    hslToHex(h + 90, s, l),
    hslToHex(h + 180, s, l),
    hslToHex(h + 270, s, l),
  ];
}

export function monochromatic(h: number, s: number, l: number): string[] {
  // Five swatches: primary at index 0, then darker, dark, lighter, light.
  // Lightness offsets centre on the primary so the painter sees both
  // shadow and highlight extension.
  const offsets = [0, -25, -12, 12, 25];
  return offsets.map((delta) => {
    const next = clamp(l + delta, 10, 90);
    return hslToHex(h, s, next);
  });
}

export function accentedAnalogous(
  h: number,
  s: number,
  l: number,
  spread = 30,
): string[] {
  return [
    hslToHex(h, s, l),
    hslToHex(h - spread, s, l),
    hslToHex(h + spread, s, l),
    hslToHex(h + 180, s, l),
  ];
}

/**
 * Single entry point used by the wheel UI. Dispatches to the named
 * harmony function above.
 */
export function buildHarmony(
  key: HarmonyKey,
  h: number,
  s: number,
  l: number,
): string[] {
  switch (key) {
    case "complementary":
      return complementary(h, s, l);
    case "analogous":
      return analogous(h, s, l);
    case "triadic":
      return triadic(h, s, l);
    case "tetradic":
      return tetradic(h, s, l);
    case "splitComplementary":
      return splitComplementary(h, s, l);
    case "square":
      return square(h, s, l);
    case "monochromatic":
      return monochromatic(h, s, l);
    case "accentedAnalogous":
      return accentedAnalogous(h, s, l);
  }
}

/* ============================================================
   Helpers
   ============================================================ */

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

function toHex(channel: number): string {
  const v = Math.round(clamp01(channel) * 255);
  return v.toString(16).padStart(2, "0");
}

function normaliseHex(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const m =
    /^#?([0-9a-fA-F]{3})$/.exec(trimmed) ??
    /^#?([0-9a-fA-F]{6})$/.exec(trimmed);
  const body = m?.[1];
  if (!body) return null;
  if (body.length === 3) {
    const c0 = body.charAt(0);
    const c1 = body.charAt(1);
    const c2 = body.charAt(2);
    return `#${c0}${c0}${c1}${c1}${c2}${c2}`.toUpperCase();
  }
  return `#${body.toUpperCase()}`;
}
