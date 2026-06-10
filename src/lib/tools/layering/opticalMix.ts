/**
 * Optical / subtractive layering model for the Layering tool's glaze mode.
 *
 * A transparent paint doesn't replace what's under it — light passes
 * through the film, reflects off the layer(s) below, and comes back
 * through. So the visible result is the substrate filtered by every
 * transparent layer above it. We model each layer as a partial multiply
 * filter whose strength is its `alpha` (how heavily it's laid down — thin
 * glaze vs. solid coat):
 *
 *     out_channel = in_channel * (1 - alpha * (1 - layerColor_channel))
 *
 * - alpha = 1  → full multiply (out = in * layerColor): a solid coat.
 * - alpha = 0  → no effect (out = in): nothing painted.
 *
 * Layers stack bottom → top over a substrate (the primer — white by
 * default, the standard light ground transparent paints need to "pop").
 * The multiply is commutative, but per-layer alpha is what lets a THIN
 * magenta undercoat tint a yellow toward warm amber instead of mixing to
 * red — see opticalMix.test.ts.
 *
 * Colourspace note: the multiply runs in sRGB (gamma) space, matching the
 * CSS `mix-blend-mode: multiply` look the UI renders with and the mental
 * model painters/designers already have. The single `filter()` seam below
 * is where a linear-light variant would slot in if we want more physical
 * accuracy later.
 *
 * Pure functions, no deps beyond the shared hex parser. Reusable from any
 * UI (current tool or a rebuild).
 */

import { hexToRgb01 } from "@/lib/tools/match/deltaE";

export interface GlazeLayer {
  /** The paint/colour of this transparent film, as a hex string. */
  hex: string;
  /**
   * How heavily the film is laid down, 0–1. ~0.3 reads as a thin glaze /
   * undercoat tint; ~0.85 as a solid colour coat. Clamped on use.
   */
  alpha: number;
}

/** Standard light primer ground — what transparent paints are laid over. */
export const DEFAULT_SUBSTRATE = "#ffffff";

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** One channel of the partial-multiply glaze filter (all values 0–1). */
function filter(inCh: number, layerCh: number, alpha: number): number {
  return inCh * (1 - alpha * (1 - layerCh));
}

function rgb01ToHex(r: number, g: number, b: number): string {
  const to255 = (n: number): string =>
    Math.round(clamp01(n) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}

/**
 * Stack transparent layers (bottom → top) over a substrate and return the
 * predicted painted-result hex. Layers with unparseable hex are skipped.
 * An empty stack returns the substrate.
 */
export function mixLayers(
  layers: ReadonlyArray<GlazeLayer>,
  substrateHex: string = DEFAULT_SUBSTRATE,
): string {
  const base = hexToRgb01(substrateHex) ?? { r: 1, g: 1, b: 1 };
  let { r, g, b } = base;
  for (const layer of layers) {
    const c = hexToRgb01(layer.hex);
    if (!c) continue;
    const a = clamp01(layer.alpha);
    r = filter(r, c.r, a);
    g = filter(g, c.g, a);
    b = filter(b, c.b, a);
  }
  return rgb01ToHex(r, g, b);
}

/**
 * Convenience for the 2-circle case (undercoat + glaze on top), the most
 * common glaze-mode setup. Defaults a THIN undercoat and a heavier top
 * coat so a tint-style undercoat behaves like one.
 */
export function mixUndercoatGlaze(
  undercoatHex: string,
  glazeHex: string,
  opts: { undercoatAlpha?: number; glazeAlpha?: number; substrateHex?: string } = {},
): string {
  return mixLayers(
    [
      { hex: undercoatHex, alpha: opts.undercoatAlpha ?? 0.35 },
      { hex: glazeHex, alpha: opts.glazeAlpha ?? 0.85 },
    ],
    opts.substrateHex ?? DEFAULT_SUBSTRATE,
  );
}
