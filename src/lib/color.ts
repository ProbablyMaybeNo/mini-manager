/** Colour maths for harmonies and ramps (pure presentation — drawing swatches). */

export function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = (((g - b) / d) % 6) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  if (h < 0) h += 360;
  return [h, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): string {
  const a = (s * Math.min(l, 100 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l / 100 - (a / 100) * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export type HarmonyScheme =
  | "Complementary"
  | "Analogous"
  | "Triadic"
  | "Split-Complementary"
  | "Monochromatic";

export const HARMONY_SCHEMES: HarmonyScheme[] = [
  "Complementary",
  "Analogous",
  "Triadic",
  "Split-Complementary",
  "Monochromatic",
];

/** Generate harmony swatches for a base colour + scheme. */
export function harmonies(hex: string, scheme: HarmonyScheme): string[] {
  const [h, s, l] = hexToHsl(hex);
  const rot = (deg: number) => hslToHex((h + deg + 360) % 360, s, l);
  switch (scheme) {
    case "Complementary":
      return [hex, rot(180)];
    case "Analogous":
      return [rot(-30), hex, rot(30)];
    case "Triadic":
      return [hex, rot(120), rot(240)];
    case "Split-Complementary":
      return [hex, rot(150), rot(210)];
    case "Monochromatic":
      return [
        hslToHex(h, s, Math.max(12, l - 24)),
        hslToHex(h, s, Math.max(20, l - 12)),
        hex,
        hslToHex(h, s, Math.min(88, l + 12)),
      ];
  }
}

/** Pick black or white text for legibility on a coloured background (WCAG-ish). */
export function readableText(hex: string): "#000000" | "#ffffff" {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#ffffff";
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.4 ? "#000000" : "#ffffff";
}

/** Interpolated ramp between base → shadow / highlight (Tools: layering). */
export function ramp(baseHex: string, endHex: string, steps: number): string[] {
  const a = hexToHsl(baseHex);
  const b = hexToHsl(endHex);
  return Array.from({ length: steps }, (_, i) => {
    const t = steps === 1 ? 0 : i / (steps - 1);
    return hslToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  });
}
