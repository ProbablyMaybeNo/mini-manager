/**
 * Harmony helpers for the ColorPicker primitive (P12.1).
 *
 * Slim wrapper over `src/lib/tools/wheel/harmonies.ts` that exposes
 * the locked Phase-12 harmony set (mono / analogous / complementary /
 * triadic / split / square / tetradic) under labels Ross's brief uses.
 *
 * The underlying maths is unchanged — `buildHarmony` still does the
 * hue rotations. We just translate the picker's key set to the wheel's
 * key set (`split` → `splitComplementary`, `mono` → `monochromatic`)
 * so the mini-wheel reuses the well-tested generators rather than
 * re-implementing them.
 */

import {
  buildHarmony,
  type HarmonyKey,
} from "@/lib/tools/wheel/harmonies";
import type { ColorPickerHarmony } from "./types";

interface HarmonyMeta {
  key: ColorPickerHarmony;
  label: string;
}

/** Picker label order — sequenced shortest-to-longest visually so the
 *  dropdown grows downward in a way that lines up with the wheel UI. */
export const COLOR_PICKER_HARMONY_LABELS: ReadonlyArray<HarmonyMeta> = [
  { key: "mono", label: "Monochromatic" },
  { key: "analogous", label: "Analogous" },
  { key: "complementary", label: "Complementary" },
  { key: "triadic", label: "Triadic" },
  { key: "split", label: "Split-complementary" },
  { key: "square", label: "Square" },
  { key: "tetradic", label: "Tetradic" },
];

function toWheelKey(key: ColorPickerHarmony): HarmonyKey {
  switch (key) {
    case "mono":
      return "monochromatic";
    case "split":
      return "splitComplementary";
    default:
      return key as HarmonyKey;
  }
}

/**
 * Build the harmonised swatch list for the ColorPicker wheel sub-panel.
 * Always returns at most 6 swatches (monochromatic returns 5, the others
 * 2–4); the cap keeps the wheel UI predictable.
 */
export function buildPickerHarmony(
  key: ColorPickerHarmony,
  h: number,
  s: number,
  l: number,
): string[] {
  const swatches = buildHarmony(toWheelKey(key), h, s, l);
  return swatches.slice(0, 6);
}

/**
 * Pure helper for the wheel cursor: given an angle (degrees) + a fixed
 * saturation / lightness pair, return the upper-case hex of the colour
 * under the cursor. Used by the SVG cursor on drag-end to commit a
 * selection.
 */
export { hslToHex } from "@/lib/tools/wheel/harmonies";
