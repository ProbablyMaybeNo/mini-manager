import { describe, expect, it } from "vitest";
import { closestPaint, rankMatches, nearestMatches } from "./derive";
import type { Paint } from "@/lib/types";

const paint = (id: string, hex: string, brand = "Citadel"): Paint => ({
  id,
  name: id,
  brand,
  line: "Base",
  hex,
  type: "Acrylic",
  sku: id,
  owned: false,
  wishlisted: false,
});

const pool = [
  paint("red", "#ff0000"),
  paint("green", "#00ff00", "Vallejo"),
  paint("blue", "#0000ff"),
];

describe("paint matching (host-side)", () => {
  it("closestPaint picks the nearest hue", () => {
    expect(closestPaint("#fe0a0a", pool)?.id).toBe("red");
  });

  it("rankMatches orders by distance and respects brand filter", () => {
    expect(rankMatches("#ff0000", pool)[0].paint.id).toBe("red");
    const vallejo = rankMatches("#ff0000", pool, "Vallejo");
    expect(vallejo.every((m) => m.paint.brand === "Vallejo")).toBe(true);
  });

  it("nearestMatches excludes the target itself", () => {
    const out = nearestMatches(pool[0], pool, 4);
    expect(out.find((m) => m.paint.id === "red")).toBeUndefined();
  });
});
