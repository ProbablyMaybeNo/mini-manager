/**
 * LAYERING "MATCH" button — seed one lane (SHADOW / BASE / HIGHLIGHT), derive
 * the other two. Reuses the ramp's own Lab-space primitives (`hexToLab`,
 * `lerp`, `labToHex` — {@link "@/lib/tools/gradient/interpolate"}) rather than
 * re-deriving ΔE/Lab math: each derived lane is the seed nudged a fixed
 * fraction of the way toward pure white (lighter) or pure black (darker) in
 * Lab space, which is the same kind of perceptually-even step `buildRamp`
 * already interpolates between real anchors.
 *
 * Direction depends on which lane seeds (Ross's spec):
 *   - seed BASE      → SHADOW = 1 step darker,  HIGHLIGHT = 1 step lighter
 *   - seed SHADOW    → BASE = 1 step lighter,    HIGHLIGHT = 2 steps lighter
 *   - seed HIGHLIGHT → BASE = 1 step darker,      SHADOW = 2 steps darker
 *
 * Pure function — the caller is responsible for grounding the derived hexes
 * to real catalog paints (see `groundLane.ts`).
 */

import { hexToLab, type LabColor } from "@/lib/tools/match/deltaE";
import { lerp, labToHex } from "@/lib/tools/gradient/interpolate";

export type LaneKey = "shadow" | "base" | "highlight";

export interface DerivedLanes {
  shadow: string;
  base: string;
  highlight: string;
}

const WHITE: LabColor = { L: 100, a: 0, b: 0 };
const BLACK: LabColor = { L: 0, a: 0, b: 0 };

/** Fraction of the way toward white/black per derived "step" — tuned to land
 *  close to the tool's own default shadow/base/highlight lightness gaps. */
const DERIVE_STEP = 0.28;

function lighten(lab: LabColor, steps: number): LabColor {
  return lerp(lab, WHITE, Math.min(1, DERIVE_STEP * steps));
}

function darken(lab: LabColor, steps: number): LabColor {
  return lerp(lab, BLACK, Math.min(1, DERIVE_STEP * steps));
}

/**
 * Derive all three LAYERING lanes from a single seed hex + which lane it
 * seeds. The seed lane's own hex is echoed back unchanged (upper-cased);
 * the other two are computed per the direction table above. Returns `null`
 * when the seed hex doesn't parse.
 */
export function deriveLanesFromSeed(seedLane: LaneKey, seedHex: string): DerivedLanes | null {
  const lab = hexToLab(seedHex);
  if (!lab) return null;
  const hex = seedHex.toUpperCase();

  switch (seedLane) {
    case "base":
      return { shadow: labToHex(darken(lab, 1)), base: hex, highlight: labToHex(lighten(lab, 1)) };
    case "shadow":
      return { shadow: hex, base: labToHex(lighten(lab, 1)), highlight: labToHex(lighten(lab, 2)) };
    case "highlight":
      return { shadow: labToHex(darken(lab, 2)), base: labToHex(darken(lab, 1)), highlight: hex };
    default:
      return null;
  }
}
