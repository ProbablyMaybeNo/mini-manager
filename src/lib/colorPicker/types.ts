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
  /** Paint id when a library paint was picked. `null` (or omitted) means
   *  the painter picked a raw hex via the wheel / harmony swatch /
   *  eyedropper — i.e. NO library paint backs the selection.
   *
   *  R7-001 pins this to `string | null` (not just `string?`) so the
   *  "raw hex" intent is explicit on the wire — the auditor caught a
   *  case where wheel selections silently dropped because consumers
   *  conflated `undefined` with "use the existing paintId". Callers
   *  should treat `null` and `undefined` identically (no paint). */
  paintId?: string | null;
}

/** Which side of the picker contract the host is using. Drives the
 *  in-panel microcopy + the consumer's downstream branching so the
 *  painter is never ambiguous about whether they're creating a new
 *  slot or swapping a paint on an existing one. R7-002. */
export type ColorPickerMode = "add-slot" | "edit-slot";

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
