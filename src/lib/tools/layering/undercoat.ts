/**
 * Undercoat / glaze recommender — the "brain" of the Layering tool's
 * glaze mode. Given a transparent top paint and a desired GOAL, it returns
 * a target undercoat colour (to be ΔE-matched to a real paint by the
 * caller via findClosestPaints) plus the predicted painted result.
 *
 * Two layers of knowledge:
 *  1. COMBO_TABLE — curated, source-backed pairings for the cases where
 *     real wisdom beats a formula (e.g. magenta under yellow). Keyed by
 *     `${hueBucket}:${goal}`.
 *  2. A generic HSL transform — the long-tail fallback for any hue/goal
 *     not in the table, derived from the optical rules in the research:
 *       light ground → luminous · warm/cool ground → warmer/cooler ·
 *       darker same-hue → deeper · complement → shadow/vibration ·
 *       metallic → candy sheen.
 *
 * Sources behind the rules: Old Masters Academy (glazing temperature +
 * optical hue shift), Riley Street (warm/cool/shadow grounds), Mitch
 * Albala (complementary "two-colour" vibration), Tale of Painters
 * (warm-grey zenithal), and the mini-painting metallic-candy technique.
 *
 * Pure, framework-agnostic. The caller owns paint matching + UI.
 */

import { hexToRgb01 } from "@/lib/tools/match/deltaE";
import { mixUndercoatGlaze } from "./opticalMix";

export type Goal =
  | "brighter"
  | "warmer"
  | "cooler"
  | "deeper"
  | "glow"
  | "shadow"
  | "candy";

export interface GoalMeta {
  goal: Goal;
  label: string;
  blurb: string;
}

/** UI chip definitions, in display order. */
export const GOALS: ReadonlyArray<GoalMeta> = [
  { goal: "brighter", label: "Brighter", blurb: "A light ground keeps the glaze luminous." },
  { goal: "warmer", label: "Warmer", blurb: "A warm ground pushes the colour toward red/orange." },
  { goal: "cooler", label: "Cooler", blurb: "A cool ground pushes the colour toward blue." },
  { goal: "deeper", label: "Deeper", blurb: "A darker, richer ground adds depth and saturation." },
  { goal: "glow", label: "Glow ⚡", blurb: "A near-complement ground makes a thin glaze vibrate." },
  { goal: "shadow", label: "Shadow", blurb: "A complement/violet ground sits the colour into shadow." },
  { goal: "candy", label: "Candy", blurb: "A metallic undercoat gives a rich candy/gem sheen." },
];

export interface UndercoatRecommendation {
  /** Target undercoat colour to match against the paint library. */
  undercoatHex: string;
  /** Short human label for the undercoat (e.g. "Magenta"). */
  undercoatLabel: string;
  /** Predicted painted result (undercoat thin, top glaze over it). */
  predictedHex: string;
  /** One-line explanation of why this undercoat achieves the goal. */
  rationale: string;
  /** True when the undercoat should be a METALLIC paint (candy effect). */
  metallic: boolean;
  /** Suggested paint-type filter for matching the undercoat to real paints. */
  matchTypes: ReadonlyArray<string>;
}

/* ---------------------------------------------------------------- */
/* HSL helpers (hex ⇄ hsl)                                          */
/* ---------------------------------------------------------------- */

interface Hsl {
  h: number; // 0–360
  s: number; // 0–1
  l: number; // 0–1
}

function hexToHsl(hex: string): Hsl | null {
  const rgb = hexToRgb01(hex);
  if (!rgb) return null;
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const to255 = (n: number): string =>
    Math.round(Math.min(1, Math.max(0, n + m)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}

/** Bucket a hue into a named family (for COMBO_TABLE lookup). */
export function hueBucket(h: number): string {
  const x = ((h % 360) + 360) % 360;
  if (x < 15 || x >= 345) return "red";
  if (x < 45) return "orange";
  if (x < 70) return "yellow";
  if (x < 160) return "green";
  if (x < 200) return "cyan";
  if (x < 255) return "blue";
  if (x < 290) return "violet";
  return "magenta";
}

/** Shortest rotation of `h` toward `target`, capped at `maxStep` degrees. */
function towardHue(h: number, target: number, maxStep = 70): number {
  const d = ((target - h + 540) % 360) - 180;
  const step = Math.max(-maxStep, Math.min(maxStep, d));
  return (h + step + 360) % 360;
}

const WARM_POLE = 30; // orange
const COOL_POLE = 215; // blue

/* ---------------------------------------------------------------- */
/* Curated combos — real wisdom that beats the formula              */
/* ---------------------------------------------------------------- */

interface Combo {
  hex: string;
  label: string;
  why: string;
}

const COMBO_TABLE: Record<string, Combo> = {
  // The canonical case: thin magenta subtracts green from a yellow glaze,
  // warming it to a rich amber and making it read luminous.
  "yellow:warmer": {
    hex: "#e0218a",
    label: "Magenta",
    why: "A thin magenta undercoat subtracts green from the yellow, warming it toward rich amber — the classic glaze trick.",
  },
  "yellow:glow": {
    hex: "#e0218a",
    label: "Magenta",
    why: "Magenta under a thin yellow glaze maximises warm vibration, so the yellow glows instead of sitting flat. Keep the top thin.",
  },
  "orange:glow": {
    hex: "#d81e6a",
    label: "Magenta-pink",
    why: "A magenta ground deepens and energises an orange glaze without cooling it.",
  },
  "green:glow": {
    hex: "#b03326",
    label: "Warm red / sienna",
    why: "A red/sienna ground under a green glaze makes the green vibrate (complementary adjacency) — Albala's two-colour method.",
  },
  "blue:glow": {
    hex: "#d98330",
    label: "Burnt orange",
    why: "A warm complement under a cool blue glaze adds glow and stops it reading flat and cold.",
  },
  "red:glow": {
    hex: "#1f8a4c",
    label: "Green",
    why: "A green ground under a thin red glaze intensifies the red through complementary contrast.",
  },
};

/* ---------------------------------------------------------------- */
/* The recommender                                                  */
/* ---------------------------------------------------------------- */

const TRANSPARENT_TYPES = ["Contrast", "Wash", "Glaze", "Ink", "Speedpaint", "Xpress"];
const OPAQUE_BASE_TYPES = ["Acrylic", "Paint", "Primer"];
const METALLIC_TYPES = ["Metallic", "Metal"];

/**
 * Recommend an undercoat for a transparent top paint to hit `goal`.
 * `topHex` is the colour of the paint going on top. Falls back to a grey
 * mid-tone target if the hex can't be parsed.
 */
export function recommendUndercoat(topHex: string, goal: Goal): UndercoatRecommendation {
  const hsl = hexToHsl(topHex) ?? { h: 0, s: 0, l: 0.5 };
  const bucket = hueBucket(hsl.h);

  // Candy is always a metallic undercoat, independent of hue table.
  if (goal === "candy") {
    const warm = hsl.h < 150 || hsl.h >= 330;
    const undercoatHex = warm ? "#c8a03c" : "#c0c8d0"; // gold vs silver
    return finalize(
      topHex,
      undercoatHex,
      warm ? "Gold" : "Silver",
      `A ${warm ? "gold" : "silver"} metallic undercoat gives a rich candy/gem sheen through the transparent paint.`,
      true,
      METALLIC_TYPES,
    );
  }

  // Curated combo wins when present.
  const combo = COMBO_TABLE[`${bucket}:${goal}`];
  if (combo) {
    return finalize(topHex, combo.hex, combo.label, combo.why, false, OPAQUE_BASE_TYPES);
  }

  // Generic HSL transform fallback.
  const { target, label, why } = genericUndercoat(hsl, goal);
  return finalize(topHex, hslToHex(target), label, why, false, OPAQUE_BASE_TYPES);
}

function genericUndercoat(
  hsl: Hsl,
  goal: Goal,
): { target: Hsl; label: string; why: string } {
  switch (goal) {
    case "brighter":
      return {
        target: { h: hsl.h, s: hsl.s * 0.35, l: 0.9 },
        label: "Light tint",
        why: "A near-white tint of the same hue keeps the glaze transparent and luminous.",
      };
    case "warmer":
      return {
        target: { h: towardHue(hsl.h, WARM_POLE), s: Math.min(1, hsl.s * 0.9 + 0.2), l: 0.55 },
        label: "Warm ground",
        why: "A warm ground biases the colour toward red/orange.",
      };
    case "cooler":
      return {
        target: { h: towardHue(hsl.h, COOL_POLE), s: Math.min(1, hsl.s * 0.9 + 0.2), l: 0.5 },
        label: "Cool ground",
        why: "A cool ground biases the colour toward blue.",
      };
    case "deeper":
      return {
        target: { h: hsl.h, s: Math.min(1, hsl.s * 1.3 + 0.1), l: hsl.l * 0.45 },
        label: "Deep ground",
        why: "A darker, more saturated ground of the same hue adds depth and richness.",
      };
    case "glow":
      return {
        target: { h: (hsl.h + 180) % 360, s: 0.7, l: 0.5 },
        label: "Complement",
        why: "A near-complement ground makes a thin glaze on top vibrate. Keep the top layer thin or it neutralises.",
      };
    case "shadow":
      return {
        target: { h: (hsl.h + 175) % 360, s: hsl.s * 0.7 + 0.1, l: hsl.l * 0.4 },
        label: "Shadow ground",
        why: "A dark complement/violet ground sits the colour into shadow.",
      };
    default:
      return {
        target: { h: hsl.h, s: hsl.s, l: hsl.l },
        label: "Ground",
        why: "Same-hue ground.",
      };
  }
}

function finalize(
  topHex: string,
  undercoatHex: string,
  undercoatLabel: string,
  rationale: string,
  metallic: boolean,
  matchTypes: ReadonlyArray<string>,
): UndercoatRecommendation {
  return {
    undercoatHex,
    undercoatLabel,
    predictedHex: mixUndercoatGlaze(undercoatHex, topHex),
    rationale,
    metallic,
    matchTypes,
  };
}

/** Paint-type filters, exported so the matcher/UI can reuse them. */
export const PAINT_TYPE_FILTERS = {
  transparent: TRANSPARENT_TYPES,
  opaqueBase: OPAQUE_BASE_TYPES,
  metallic: METALLIC_TYPES,
} as const;
