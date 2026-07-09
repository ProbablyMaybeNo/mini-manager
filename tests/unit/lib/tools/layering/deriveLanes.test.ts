import { describe, expect, test } from "vitest";
import { deriveLanesFromSeed } from "@/lib/tools/layering/deriveLanes";
import { hexToLab } from "@/lib/tools/match/deltaE";

function lightness(hex: string): number {
  return hexToLab(hex)!.L;
}

describe("deriveLanesFromSeed — seed = base", () => {
  test("echoes the seed back on the base lane", () => {
    const out = deriveLanesFromSeed("base", "#3a6ea5");
    expect(out).not.toBeNull();
    expect(out!.base).toBe("#3A6EA5");
  });

  test("shadow is darker than base, highlight is lighter than base", () => {
    const out = deriveLanesFromSeed("base", "#3a6ea5")!;
    expect(lightness(out.shadow)).toBeLessThan(lightness(out.base));
    expect(lightness(out.highlight)).toBeGreaterThan(lightness(out.base));
  });
});

describe("deriveLanesFromSeed — seed = shadow", () => {
  test("echoes the seed back on the shadow lane", () => {
    const out = deriveLanesFromSeed("shadow", "#13243a");
    expect(out!.shadow).toBe("#13243A");
  });

  test("base is lighter than shadow, highlight is lighter still", () => {
    const out = deriveLanesFromSeed("shadow", "#13243a")!;
    expect(lightness(out.base)).toBeGreaterThan(lightness(out.shadow));
    expect(lightness(out.highlight)).toBeGreaterThan(lightness(out.base));
  });
});

describe("deriveLanesFromSeed — seed = highlight", () => {
  test("echoes the seed back on the highlight lane", () => {
    const out = deriveLanesFromSeed("highlight", "#9fc6ee");
    expect(out!.highlight).toBe("#9FC6EE");
  });

  test("base is darker than highlight, shadow is darker still", () => {
    const out = deriveLanesFromSeed("highlight", "#9fc6ee")!;
    expect(lightness(out.base)).toBeLessThan(lightness(out.highlight));
    expect(lightness(out.shadow)).toBeLessThan(lightness(out.base));
  });
});

describe("deriveLanesFromSeed guards", () => {
  test("malformed seed hex returns null", () => {
    expect(deriveLanesFromSeed("base", "not-a-hex")).toBeNull();
  });

  test("every derived hex is a valid 6-digit hex", () => {
    const HEX6 = /^#[0-9A-F]{6}$/;
    for (const seed of ["shadow", "base", "highlight"] as const) {
      const out = deriveLanesFromSeed(seed, "#7f2bd6")!;
      expect(out.shadow).toMatch(HEX6);
      expect(out.base).toMatch(HEX6);
      expect(out.highlight).toMatch(HEX6);
    }
  });
});
