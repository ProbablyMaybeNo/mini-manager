import { describe, expect, test } from "vitest";
import {
  closestPaint,
  nearestMatches,
  rankMatches,
  rankMatchesMulti,
  similarInOtherBrands,
} from "@/lib/toolMatch";
import type { Paint } from "@/lib/types";

function paint(id: string, brand: string, hex: string): Paint {
  return {
    id,
    name: `Paint ${id}`,
    brand,
    line: "",
    hex,
    type: "Acrylic",
    sku: "",
    owned: false,
    wishlisted: false,
  };
}

const pool: Paint[] = [
  paint("a", "Citadel", "#0000ff"), // blue
  paint("b", "Vallejo", "#0808ff"), // near-blue
  paint("c", "Citadel", "#ff0000"), // red
  paint("d", "Army Painter", "#00ff00"), // green
];

describe("closestPaint", () => {
  test("returns the perceptually nearest paint", () => {
    expect(closestPaint("#0000fe", pool)?.id).toBe("a");
  });

  test("returns null for an empty pool", () => {
    expect(closestPaint("#0000ff", [])).toBeNull();
  });
});

describe("rankMatches (single brand)", () => {
  test("orders ascending by distance and honours a brand filter", () => {
    const res = rankMatches("#0000ff", pool, "Citadel");
    expect(res.every((r) => r.paint.brand === "Citadel")).toBe(true);
    expect(res[0]?.paint.id).toBe("a");
  });
});

describe("rankMatchesMulti", () => {
  test("empty brand list = all brands, sorted by distance ascending", () => {
    const res = rankMatchesMulti("#0000ff", pool, []);
    expect(res[0]?.paint.id).toBe("a");
    expect(res[1]?.paint.id).toBe("b");
    // distances are non-decreasing
    for (let i = 1; i < res.length; i++) {
      expect(res[i]!.distanceScore).toBeGreaterThanOrEqual(res[i - 1]!.distanceScore);
    }
  });

  test("filters to the union of the selected brands", () => {
    const res = rankMatchesMulti("#0000ff", pool, ["Vallejo", "Army Painter"]);
    expect(res.map((r) => r.paint.brand).sort()).toEqual(["Army Painter", "Vallejo"]);
  });

  test("respects the limit", () => {
    expect(rankMatchesMulti("#0000ff", pool, [], 2)).toHaveLength(2);
  });
});

describe("nearestMatches (library panel)", () => {
  // O9MuXo7ZQdM- — a saturated red must surface reddish paints, never
  // black/white. The old hue-only heuristic ranked greys first because they
  // share hue 0 with pure red.
  const red = paint("red", "Citadel", "#ff0000");
  const withGreys: Paint[] = [
    red,
    paint("black", "Vallejo", "#000000"),
    paint("white", "Vallejo", "#ffffff"),
    paint("crimson", "Army Painter", "#e01818"),
    paint("blue", "Citadel", "#0000ff"),
  ];

  test("excludes the paint itself", () => {
    expect(nearestMatches(red, withGreys, 4).some((m) => m.paint.id === "red")).toBe(false);
  });

  test("ranks a perceptually-near red above black and white", () => {
    const top = nearestMatches(red, withGreys, 1)[0];
    expect(top?.paint.id).toBe("crimson");
  });

  test("does not rank black or white as the closest match to red", () => {
    expect(nearestMatches(red, withGreys, 1)[0]?.paint.id).not.toBe("black");
    expect(nearestMatches(red, withGreys, 1)[0]?.paint.id).not.toBe("white");
  });
});

describe("similarInOtherBrands", () => {
  const red = paint("red", "Citadel", "#ff0000");
  const withGreys: Paint[] = [
    red,
    paint("citadel-crimson", "Citadel", "#e01818"), // same brand → excluded
    paint("ap-crimson", "Army Painter", "#e01818"),
    paint("vallejo-black", "Vallejo", "#000000"),
  ];

  test("excludes self and same-brand paints, ranks by perceptual distance", () => {
    const res = similarInOtherBrands(red, withGreys, 4);
    expect(res.every((p) => p.brand !== "Citadel")).toBe(true);
    expect(res[0]?.id).toBe("ap-crimson");
  });
});
