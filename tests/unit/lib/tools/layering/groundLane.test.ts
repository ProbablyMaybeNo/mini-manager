import { describe, expect, test } from "vitest";
import { groundLane } from "@/lib/tools/layering/groundLane";
import type { Paint } from "@/lib/types";

function paint(id: string, hex: string, brand = "Acme"): Paint {
  return {
    id,
    name: id,
    brand,
    line: "",
    hex,
    type: "Acrylic",
    sku: "",
    owned: false,
    wishlisted: false,
  };
}

// Deep navy target. "near-owned" is a very close but not identical match;
// "far-owned" is a completely different hue so it should never win even
// when ownedFirst is on.
const TARGET = "#13243A";
const CLOSEST_CATALOG = paint("closest", "#132239"); // near-identical
const NEAR_OWNED = paint("near-owned", "#152840");
const FAR_OWNED = paint("far-owned", "#F2E400"); // bright yellow — nothing alike
const POOL = [CLOSEST_CATALOG, NEAR_OWNED, FAR_OWNED];

describe("groundLane — default (closest catalog match)", () => {
  test("ignores ownership and returns the catalog-wide closest paint", () => {
    const result = groundLane(TARGET, POOL, new Set(["far-owned"]), false);
    expect(result?.id).toBe("closest");
  });
});

describe("groundLane — owned-first", () => {
  test("prefers a close-enough owned paint over the catalog-wide closest", () => {
    const result = groundLane(TARGET, POOL, new Set(["near-owned"]), true);
    expect(result?.id).toBe("near-owned");
  });

  test("falls back to the catalog-wide closest when the only owned paint is a bad match", () => {
    const result = groundLane(TARGET, POOL, new Set(["far-owned"]), true);
    expect(result?.id).toBe("closest");
  });

  test("falls back to the catalog-wide closest when nothing is owned", () => {
    const result = groundLane(TARGET, POOL, new Set(), true);
    expect(result?.id).toBe("closest");
  });
});

describe("groundLane guards", () => {
  test("empty pool returns null", () => {
    expect(groundLane(TARGET, [], new Set(), false)).toBeNull();
  });
});
