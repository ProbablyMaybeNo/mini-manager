import { describe, expect, test } from "vitest";
import { computeVennFills } from "@/lib/tools/layering/venn";
import { mixLayers } from "@/lib/tools/layering/opticalMix";
import type { GlazeLayer } from "@/lib/tools/layering/opticalMix";

describe("computeVennFills", () => {
  test("1 layer: solo fill equals the result fill (trivial single-circle case)", () => {
    const layers: GlazeLayer[] = [{ hex: "#8a1f1f", alpha: 0.4 }];
    const { soloFills, resultFill } = computeVennFills(layers);
    expect(soloFills).toHaveLength(1);
    expect(soloFills[0]).toBe(resultFill);
    expect(soloFills[0]).toBe(mixLayers(layers, "#ffffff"));
  });

  test("2 layers: solo fills are each layer alone; result is the full stack", () => {
    const layers: GlazeLayer[] = [
      { hex: "#8a1f1f", alpha: 0.4 },
      { hex: "#c01010", alpha: 0.85 },
    ];
    const { soloFills, resultFill } = computeVennFills(layers);
    expect(soloFills[0]).toBe(mixLayers([layers[0]!], "#ffffff"));
    expect(soloFills[1]).toBe(mixLayers([layers[1]!], "#ffffff"));
    expect(resultFill).toBe(mixLayers(layers, "#ffffff"));
    // The full stack is not just either solo layer in isolation.
    expect(resultFill).not.toBe(soloFills[0]);
    expect(resultFill).not.toBe(soloFills[1]);
  });

  test("N>2 layers: result composites every layer, and differs from any partial stack", () => {
    const layers: GlazeLayer[] = [
      { hex: "#111111", alpha: 0.3 },
      { hex: "#8a1f1f", alpha: 0.5 },
      { hex: "#eebb00", alpha: 0.6 },
    ];
    const { soloFills, resultFill } = computeVennFills(layers);
    expect(soloFills).toHaveLength(3);
    expect(resultFill).toBe(mixLayers(layers, "#ffffff"));
    // The 3-layer result is distinct from any 2-of-3 partial stack.
    expect(resultFill).not.toBe(mixLayers(layers.slice(0, 2), "#ffffff"));
    expect(resultFill).not.toBe(mixLayers(layers.slice(1, 3), "#ffffff"));
  });

  test("honours a custom substrate", () => {
    const layers: GlazeLayer[] = [{ hex: "#00ff00", alpha: 0.5 }];
    const { resultFill } = computeVennFills(layers, "#000000");
    expect(resultFill).toBe(mixLayers(layers, "#000000"));
    expect(resultFill).not.toBe(mixLayers(layers, "#ffffff"));
  });

  test("empty layer list returns the bare substrate for both", () => {
    const { soloFills, resultFill } = computeVennFills([], "#123456");
    expect(soloFills).toEqual([]);
    expect(resultFill).toBe("#123456");
  });
});
