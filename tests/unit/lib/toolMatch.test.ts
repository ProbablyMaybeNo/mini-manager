import { describe, expect, test } from "vitest";
import { closestPaint, rankMatches, rankMatchesMulti } from "@/lib/toolMatch";
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
