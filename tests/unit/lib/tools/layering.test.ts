import { describe, expect, test } from "vitest";
import { hexToRgb01 } from "@/lib/tools/match/deltaE";
import { mixUndercoatGlaze, mixLayers } from "@/lib/tools/layering/opticalMix";
import {
  recommendUndercoat,
  hueBucket,
  GOALS,
} from "@/lib/tools/layering/undercoat";

/** Hex → 0–255 channels for readable assertions. */
function rgb255(hex: string): { r: number; g: number; b: number } {
  const c = hexToRgb01(hex)!;
  return { r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255) };
}

describe("optical mix — the magenta-under-yellow case", () => {
  test("thin magenta under a yellow glaze reads warm amber, NOT red", () => {
    const out = mixUndercoatGlaze("#ff00ff", "#ffff00"); // magenta under yellow
    const { r, g, b } = rgb255(out);
    // Red channel stays full (both layers pass red through).
    expect(r).toBe(255);
    // Green is pulled down by the thin magenta — warmed/deepened...
    expect(g).toBeLessThan(255);
    // ...but it's still clearly a yellow/orange, not a red: green ≫ blue.
    expect(g).toBeGreaterThan(140);
    expect(g).toBeGreaterThan(b + 80);
    expect(b).toBeLessThan(60);
  });

  test("the magenta undercoat warms vs. yellow alone (lower green)", () => {
    const withUndercoat = rgb255(mixUndercoatGlaze("#ff00ff", "#ffff00"));
    const yellowAlone = rgb255(
      mixUndercoatGlaze("#ff00ff", "#ffff00", { undercoatAlpha: 0 }),
    );
    expect(yellowAlone.g).toBe(255); // no undercoat → pure yellow
    expect(withUndercoat.g).toBeLessThan(yellowAlone.g);
  });

  test("heavier magenta correctly slides the overlap toward red", () => {
    const thin = rgb255(mixUndercoatGlaze("#ff00ff", "#ffff00", { undercoatAlpha: 0.3 }));
    const heavy = rgb255(mixUndercoatGlaze("#ff00ff", "#ffff00", { undercoatAlpha: 0.95 }));
    // More magenta → less green left → closer to red.
    expect(heavy.g).toBeLessThan(thin.g);
  });

  test("empty stack returns the substrate; full multiply at alpha 1", () => {
    expect(mixLayers([])).toBe("#ffffff");
    // alpha 1 = pure multiply: magenta(1,0,1) × yellow(1,1,0) = red(1,0,0).
    const red = rgb255(
      mixLayers([
        { hex: "#ff00ff", alpha: 1 },
        { hex: "#ffff00", alpha: 1 },
      ]),
    );
    expect(red).toEqual({ r: 255, g: 0, b: 0 });
  });
});

describe("undercoat recommender", () => {
  test("yellow + warmer → magenta (the curated combo)", () => {
    const rec = recommendUndercoat("#ffff00", "warmer");
    expect(rec.undercoatLabel).toBe("Magenta");
    expect(rec.metallic).toBe(false);
    const predicted = rgb255(rec.predictedHex);
    expect(predicted.g).toBeLessThan(255); // warmed
  });

  test("candy goal returns a metallic undercoat with metallic match types", () => {
    const warm = recommendUndercoat("#cc2222", "candy");
    expect(warm.metallic).toBe(true);
    expect(warm.undercoatLabel).toBe("Gold");
    expect(warm.matchTypes).toContain("Metallic");

    const cool = recommendUndercoat("#2244cc", "candy");
    expect(cool.undercoatLabel).toBe("Silver");
  });

  test("generic fallback produces a parseable undercoat for every goal", () => {
    for (const { goal } of GOALS) {
      const rec = recommendUndercoat("#3a7bd5", goal);
      expect(hexToRgb01(rec.undercoatHex)).not.toBeNull();
      expect(hexToRgb01(rec.predictedHex)).not.toBeNull();
      expect(rec.rationale.length).toBeGreaterThan(0);
    }
  });

  test("hue buckets map as expected", () => {
    expect(hueBucket(60)).toBe("yellow");
    expect(hueBucket(0)).toBe("red");
    expect(hueBucket(300)).toBe("magenta");
    expect(hueBucket(215)).toBe("blue");
  });
});
