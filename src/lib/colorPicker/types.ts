/**
 * Shared types for the ColorPicker primitive (P12.1).
 *
 * The picker emits a small `ColorPickerSelection` shape via `onSelect`.
 * Every consumer (recipe slot grid, project Color Scheme box, Progress
 * table inline-edit, Layering tool, Eyedropper pins) reads the same
 * payload — paint id when one was picked from the library or matched
 * the hex within a tight ΔE, otherwise just the raw hex.
 */

export interface ColorPickerSelection {
  /** Normalised `#RRGGBB` (upper-case) hex of the chosen colour. */
  hex: string;
  /** Optional paint id if a library paint was picked (or matched closely). */
  paintId?: string;
}

/** Locked harmony key set from Ross's Q&A — the wheel-tool's full set
 *  is intentionally narrower here. `splitComplementary` becomes `split`
 *  for the dropdown label; the underlying maths is the same. */
export const COLOR_PICKER_HARMONIES = [
  "mono",
  "analogous",
  "complementary",
  "triadic",
  "split",
  "square",
  "tetradic",
] as const;
export type ColorPickerHarmony = (typeof COLOR_PICKER_HARMONIES)[number];

/** Which sub-panel the user is interacting with. The picker stacks all
 *  three but every interaction emits the selection on the same handler. */
export type ColorPickerSource = "wheel" | "library" | "eyedropper";
