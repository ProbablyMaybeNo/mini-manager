/**
 * Shared types for the Tools layer (Phase 4).
 *
 * Every tool emits a `ToolPaletteOutput` — the lingua franca that powers
 * "send → recipe" (P4.7) and "save as palette" (P4.4). A palette is a
 * small ordered list of colour swatches, each optionally tied to a paint
 * id from the library. Tools that produce a single colour (Match `[Use]`)
 * emit a one-element palette.
 */

export const toolIds = [
  "wheel",
  "match",
  "eyedropper",
  "gradient",
] as const;
export type ToolId = (typeof toolIds)[number];

/**
 * One swatch in a tool's output palette.
 *
 * `hex` is the canonical #RRGGBB representation. `name` is an optional
 * label that surfaces in the recipe step (e.g. the matched paint's name).
 * `sourcePaintId` is set when the swatch corresponds to a real catalog
 * paint — the send-to-recipe flow uses it to attach the paint id directly
 * instead of writing a custom-hex step.
 */
export interface ToolPaletteSwatch {
  hex: string;
  name?: string;
  sourcePaintId?: string;
}

/**
 * The unified shape every tool emits. Phase 4 milestones use this to
 * hand colours between Wheel / Match / Eyedropper / Gradient and the
 * Recipe layer.
 */
export interface ToolPaletteOutput {
  toolId: ToolId;
  swatches: ReadonlyArray<ToolPaletteSwatch>;
}
