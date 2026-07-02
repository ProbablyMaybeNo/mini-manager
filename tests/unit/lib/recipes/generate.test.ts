import { describe, expect, test } from "vitest";
import {
  LAYER_ROLE_ORDER,
  ROLE_TO_LAYER,
  buildLayerRamp,
  expandPalette,
  groundRampToCatalog,
  groundedColorsToSlots,
  scoreHarmony,
} from "@/lib/recipes/generate";
import { clampHue, hexToHsl, hslToHex } from "@/lib/tools/wheel/harmonies";
import type { Paint } from "@/lib/paints/types";

/** Minimal catalog paint for grounding fixtures. */
function paint(id: string, hex: string): Paint {
  return {
    id,
    brand: "Test",
    name: id,
    type: "Paint",
    hex,
    hexConfidence: "high",
    hexSource: "test",
    sourceUrl: "",
  };
}

/** Lightness of a hex, for asserting ramp ordering. */
function lightnessOf(hex: string): number {
  const hsl = hexToHsl(hex);
  if (!hsl) throw new Error(`Invalid hex: ${hex}`);
  return hsl.l;
}

/** Shortest hue distance to a wheel anchor — wrap-aware. */
function distTo(h: number, anchor: number): number {
  const d = Math.abs(clampHue(h) - anchor) % 360;
  return d > 180 ? 360 - d : d;
}

describe("buildLayerRamp", () => {
  test("emits the five roles in dark→light order", () => {
    const ramp = buildLayerRamp("#C0392B"); // a mid red
    expect(ramp).not.toBeNull();
    expect(ramp!.steps.map((s) => s.role)).toEqual(LAYER_ROLE_ORDER);
  });

  test("shade is darker than base and edge is the lightest", () => {
    const ramp = buildLayerRamp("#2E86DE")!; // a mid blue
    const byRole = Object.fromEntries(ramp.steps.map((s) => [s.role, s.hex]));
    expect(lightnessOf(byRole.shade)).toBeLessThan(lightnessOf(byRole.base));
    expect(lightnessOf(byRole.highlight)).toBeGreaterThan(lightnessOf(byRole.base));
    expect(lightnessOf(byRole.edge)).toBeGreaterThan(lightnessOf(byRole.highlight));
  });

  test("shadows tint cooler, highlights tint warmer (tinted ramp, not a flat slider)", () => {
    const base = hexToHsl("#C0392B")!; // warm red, hue ~6
    const ramp = buildLayerRamp("#C0392B")!;
    const shade = ramp.steps.find((s) => s.role === "shade")!;
    const hi = ramp.steps.find((s) => s.role === "highlight")!;
    // Shade sits closer to the cool anchor (250°) than the base; highlight sits
    // closer to the warm anchor (50°) — wrap-aware, so it holds for any hue.
    expect(distTo(shade.hsl.h, 250)).toBeLessThan(distTo(base.h, 250));
    expect(distTo(hi.hsl.h, 50)).toBeLessThan(distTo(base.h, 50));
  });

  test("every step is a valid #RRGGBB and lightness never crushes to pure black/white", () => {
    const ramp = buildLayerRamp("#111111")!; // near-black stress input
    for (const step of ramp.steps) {
      expect(step.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(step.hsl.l).toBeGreaterThanOrEqual(6);
      expect(step.hsl.l).toBeLessThanOrEqual(94);
    }
  });

  test("returns null for an unparseable hex", () => {
    expect(buildLayerRamp("not-a-color")).toBeNull();
  });
});

describe("scoreHarmony", () => {
  test("a complementary pair is labelled complementary with high cohesion", () => {
    const score = scoreHarmony(["#FF0000", "#00FFFF"]); // 0° vs 180°
    expect(score.harmony).toBe("complementary");
    expect(score.cohesion).toBeGreaterThan(0.9);
  });

  test("evenly spaced triad is labelled triadic", () => {
    const score = scoreHarmony(["#FF0000", "#00FF00", "#0000FF"]); // 0/120/240
    expect(score.harmony).toBe("triadic");
  });

  test("flags a muddy pair (close hue, close value)", () => {
    // Two colours 25° apart at identical lightness — built exactly so the
    // gap lands in the muddy band [18,55] and the value delta is ~0.
    const a = hslToHex(25, 55, 50);
    const b = hslToHex(50, 55, 50);
    const score = scoreHarmony([a, b]);
    expect(score.clashes.length).toBeGreaterThan(0);
  });

  test("a single pick is trivially monochromatic with no clashes", () => {
    const score = scoreHarmony(["#8E44AD"]);
    expect(score.harmony).toBe("monochromatic");
    expect(score.clashes).toHaveLength(0);
  });
});

describe("expandPalette", () => {
  test("one anchor yields companion palettes (anchor first in each)", () => {
    const suggestions = expandPalette(["#2E86DE"]);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.swatches[0]).toBe("#2E86DE".toUpperCase());
      expect(s.swatches.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("returns nothing to expand once two or more colours are picked", () => {
    expect(expandPalette(["#2E86DE", "#C0392B"])).toEqual([]);
  });
});

describe("groundRampToCatalog", () => {
  test("a step whose exact hex is in the catalog grounds to it with high confidence", () => {
    const ramp = buildLayerRamp("#2E86DE")!;
    const baseHex = ramp.steps.find((s) => s.role === "base")!.hex;
    const catalog = [paint("exact", baseHex), paint("black", "#000000")];
    const [grounded] = groundRampToCatalog([ramp], catalog);
    const baseStep = grounded.steps.find((s) => s.role === "base")!;
    expect(baseStep.paint?.id).toBe("exact");
    expect(baseStep.confidence).toBe("high");
    expect(baseStep.deltaE).toBeCloseTo(0, 1);
  });

  test("an empty catalog leaves every step unmatched", () => {
    const ramp = buildLayerRamp("#2E86DE")!;
    const [grounded] = groundRampToCatalog([ramp], []);
    expect(grounded.steps.every((s) => s.paint === null)).toBe(true);
  });

  test("the brand filter restricts which paints can match", () => {
    const ramp = buildLayerRamp("#2E86DE")!;
    const baseHex = ramp.steps.find((s) => s.role === "base")!.hex;
    const catalog = [{ ...paint("exact", baseHex), brand: "Vallejo" }];
    const [grounded] = groundRampToCatalog([ramp], catalog, { brands: ["Citadel"] });
    expect(grounded.steps.every((s) => s.paint === null)).toBe(true);
  });
});

describe("groundedColorsToSlots", () => {
  test("close matches become paint slots; far matches fall back to custom hex", () => {
    const ramp = buildLayerRamp("#C0392B")!;
    const baseHex = ramp.steps.find((s) => s.role === "base")!.hex;
    // Catalog holds ONLY an exact base match; every other ramp step is far away.
    const grounded = groundRampToCatalog([ramp], [paint("base-match", baseHex)]);
    const slots = groundedColorsToSlots(grounded);

    expect(slots).toHaveLength(5); // one colour × five roles
    const base = slots.find((s) => s.role === "base")!;
    expect(base.paintId).toBe("base-match");
    // The far steps (shade/edge) had no trustworthy match → custom hex, no id.
    const shade = slots.find((s) => s.role === "shade")!;
    expect(shade.paintId).toBeNull();
    expect(shade.hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  test("maps each role to the saveRecipe layer label", () => {
    const ramp = buildLayerRamp("#4A7A2B")!;
    const grounded = groundRampToCatalog([ramp], []);
    const slots = groundedColorsToSlots(grounded);
    for (const s of slots) {
      expect(s.layer).toBe(ROLE_TO_LAYER[s.role]);
    }
    expect(slots.find((s) => s.role === "edge")!.layer).toBe("edge highlight");
  });
});
