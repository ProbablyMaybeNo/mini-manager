/**
 * P12.15 — Eyedropper pin placement.
 *
 * Given a SampledImage + the extracted dominant colours, place a
 * pin at the pixel closest to each colour. Pure helper, no DOM.
 */
import { describe, expect, test } from "vitest";
import { placePins } from "@/lib/tools/eyedropper/pinPlacement";
import type { SampledImage } from "@/lib/tools/eyedropper/sample";

function buildImage(
  width: number,
  height: number,
  pixelFn: (x: number, y: number) => [number, number, number, number],
): SampledImage {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const idx = (y * width + x) * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = a;
    }
  }
  return { width, height, pixels };
}

describe("placePins", () => {
  test("places one pin per target hex, in the same order", () => {
    // Three-block image: left third red, middle third green, right third blue.
    const image = buildImage(30, 10, (x) => {
      if (x < 10) return [255, 0, 0, 255];
      if (x < 20) return [0, 255, 0, 255];
      return [0, 0, 255, 255];
    });
    const out = placePins(image, ["#FF0000", "#00FF00", "#0000FF"]);
    expect(out.length).toBe(3);
    expect(out[0]?.hex).toBe("#FF0000");
    expect(out[1]?.hex).toBe("#00FF00");
    expect(out[2]?.hex).toBe("#0000FF");
    // Red lives in x < 10, green 10-19, blue 20-29.
    expect(out[0]?.x).toBeLessThan(10);
    expect(out[1]?.x ?? -1).toBeGreaterThanOrEqual(10);
    expect(out[1]?.x ?? 99).toBeLessThan(20);
    expect(out[2]?.x ?? -1).toBeGreaterThanOrEqual(20);
  });

  test("returns an empty array for an empty hex list", () => {
    const image = buildImage(4, 4, () => [128, 128, 128, 255]);
    expect(placePins(image, [])).toEqual([]);
  });

  test("skips malformed hexes in the input", () => {
    const image = buildImage(4, 4, () => [128, 128, 128, 255]);
    const out = placePins(image, ["#FF0000", "not-a-hex", "#00FF00"]);
    // The middle malformed target is skipped — output has 2 placements.
    expect(out.length).toBe(2);
  });

  test("skips fully-transparent pixels", () => {
    // Top half transparent + bottom half red. Pin for red lands in the
    // bottom half (y >= 5).
    const image = buildImage(10, 10, (_, y) => {
      if (y < 5) return [255, 0, 0, 0]; // transparent red
      return [255, 0, 0, 255]; // opaque red
    });
    const out = placePins(image, ["#FF0000"]);
    expect(out.length).toBe(1);
    expect((out[0]?.y ?? -1)).toBeGreaterThanOrEqual(5);
  });

  test("the placed hex matches the actual sampled pixel (not the target)", () => {
    // Image is pure dark-red (#660000); target is bright red (#FF0000).
    // Pin position should sample dark red, not bright red.
    const image = buildImage(4, 4, () => [102, 0, 0, 255]); // 0x66 = 102
    const out = placePins(image, ["#FF0000"]);
    expect(out[0]?.hex).toBe("#660000");
  });
});

describe("EyedropperPins component surface", () => {
  test("Pin interface has x / y / hex", async () => {
    // Light smoke test of the type — compile-time only.
    const mod = await import("@/components/tools/eyedropper/EyedropperPins");
    expect(mod.EyedropperPins).toBeTypeOf("function");
  });
});

describe("EyedropperClient — pin-driven palette", () => {
  test("imports placePins + EyedropperPins from the new modules", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.resolve(process.cwd(), "src/components/tools/eyedropper/EyedropperClient.tsx"),
      "utf-8",
    );
    expect(src).toContain("placePins");
    expect(src).toContain("EyedropperPins");
  });

  test("pins state replaces the standalone swatches state as source of truth", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.resolve(process.cwd(), "src/components/tools/eyedropper/EyedropperClient.tsx"),
      "utf-8",
    );
    // pins state declared + swatches derived from pins
    expect(src).toMatch(/useState<ReadonlyArray<Pin>>/);
    expect(src).toContain("pins.map((p) => p.hex)");
  });
});
