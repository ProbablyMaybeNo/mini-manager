import { describe, expect, test } from "vitest";
import { extractDominantColors } from "@/lib/tools/eyedropper/kmeans";

/**
 * Build a synthetic RGBA buffer of width x height where three vertical
 * thirds carry three distinct solid colours. The kmeans tests verify
 * that k=3 recovers the three block colours.
 */
function threeBlockImage(
  width: number,
  height: number,
  colors: ReadonlyArray<[number, number, number]>,
): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(width * height * 4);
  const thirdW = Math.floor(width / colors.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const band = Math.min(colors.length - 1, Math.floor(x / thirdW));
      const c = colors[band]!;
      const off = (y * width + x) * 4;
      buf[off] = c[0];
      buf[off + 1] = c[1];
      buf[off + 2] = c[2];
      buf[off + 3] = 255;
    }
  }
  return buf;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
  );
}

describe("extractDominantColors", () => {
  test("recovers three block colours when k=3", () => {
    const colours: ReadonlyArray<[number, number, number]> = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
    ];
    const buf = threeBlockImage(60, 30, colours);
    const out = extractDominantColors(buf, 60, 30, { k: 3 });
    expect(out).toHaveLength(3);
    // Each expected colour should be close to one of the output centroids.
    for (const expected of colours) {
      const minDist = Math.min(
        ...out.map((hex) => distance(hexToRgb(hex), expected)),
      );
      expect(minDist).toBeLessThan(5);
    }
  });

  test("deterministic — same input twice produces the same palette", () => {
    const colours: ReadonlyArray<[number, number, number]> = [
      [200, 50, 50],
      [50, 200, 50],
      [50, 50, 200],
    ];
    const buf = threeBlockImage(90, 45, colours);
    const a = extractDominantColors(buf, 90, 45, { k: 3 });
    const b = extractDominantColors(buf, 90, 45, { k: 3 });
    expect(a).toEqual(b);
  });

  test("solid image returns the single colour for k=1", () => {
    const buf = threeBlockImage(20, 20, [[123, 45, 67]]);
    const out = extractDominantColors(buf, 20, 20, { k: 1 });
    expect(out).toHaveLength(1);
    expect(distance(hexToRgb(out[0]!), [123, 45, 67])).toBeLessThan(5);
  });

  test("empty buffer returns empty palette", () => {
    expect(extractDominantColors(new Uint8ClampedArray(), 0, 0)).toEqual([]);
  });
});
