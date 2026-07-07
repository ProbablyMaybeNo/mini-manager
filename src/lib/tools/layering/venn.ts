/**
 * Venn intersection colour — the pure logic behind the Stacking tool's
 * rebuilt glaze diagram (Wave 2 / thread ESVDHH6Wg78p). There's no more
 * "undercoat" — every layer is just LAYER 1..N, rendered as N overlapping
 * circles. Each circle, on its own, shows that ONE layer painted straight
 * over the substrate; the centre where every circle overlaps shows the full
 * stack (every layer, bottom → top) — the actual predicted painted result.
 *
 * Reuses `mixLayers` (the existing optical-mix model) verbatim for both —
 * this module doesn't add new colour maths, it just names the two shapes the
 * Venn needs so the component stays a dumb renderer.
 */

import { mixLayers, DEFAULT_SUBSTRATE, type GlazeLayer } from "./opticalMix";

export interface VennFills {
  /** One solo colour per layer, index-aligned with the input — that layer
   *  alone over the substrate, ignoring every other layer. */
  soloFills: string[];
  /** The full stack — every layer composited bottom → top. This is the
   *  colour the Venn's centre (all circles overlapping) renders. */
  resultFill: string;
}

/**
 * Compute both the per-layer solo fills and the full-stack result fill for
 * an arbitrary number of layers (1..N — the Stacking tool's Venn renders
 * from a single layer up, not only at 2+).
 */
export function computeVennFills(
  layers: ReadonlyArray<GlazeLayer>,
  substrate: string = DEFAULT_SUBSTRATE,
): VennFills {
  return {
    soloFills: layers.map((layer) => mixLayers([layer], substrate)),
    resultFill: mixLayers(layers, substrate),
  };
}
