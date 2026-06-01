/**
 * R7-004 — `/tools/wheel?hex=#...` (and `?name=` fallback) pre-seed.
 *
 * The auditor flagged that the Wishlist "Tools ▾ → Wheel" deep-link
 * (which always sends `?name=`) never actually seeded the wheel. The
 * fix adds two reads on the WheelClient mount:
 *
 *   1. `?hex=` — canonical. HSL-converted and used to seed the
 *      primary pick + lightness slider.
 *   2. `?name=` — fallback for callers that only know the paint title.
 *      Resolved against the loaded paint catalog via
 *      `resolvePaintByName` (case-insensitive name match), then the
 *      matched paint's hex feeds the same seed path.
 *
 * The resolver itself is exported + unit-tested for behaviour; the
 * mount wiring is pinned via source-text assertion (same pattern as
 * the rest of the picker contract tests, since the WheelClient is a
 * `'use client'` module with transitive `next/navigation` imports
 * that crash a Node-only test environment).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolvePaintByName } from "@/lib/tools/wheel/resolvePaint";
import type { Paint } from "@/lib/paints/types";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

function paint(
  id: string,
  brand: string,
  line: string,
  name: string,
  hex: string,
): Paint {
  return {
    id,
    brand,
    line,
    name,
    type: "Paint",
    hex,
    hexConfidence: "high",
    hexSource: "test",
    sourceUrl: "test://catalog",
  };
}

const CATALOG: ReadonlyArray<Paint> = [
  paint("p1", "Citadel", "Base", "Mephiston Red", "#9A1115"),
  paint("p2", "Vallejo", "Model Color", "Cavalry Brown", "#6A3525"),
  paint("p3", "Citadel", "Layer", "Evil Sunz Scarlet", "#C9302C"),
];

describe("resolvePaintByName — R7-004 catalog fallback", () => {
  test("returns null when the catalog is empty", () => {
    expect(resolvePaintByName([], "Mephiston Red")).toBeNull();
  });

  test("returns null when the title is blank", () => {
    expect(resolvePaintByName(CATALOG, "   ")).toBeNull();
  });

  test("matches exact name case-insensitively", () => {
    const m = resolvePaintByName(CATALOG, "mephiston red");
    expect(m?.id).toBe("p1");
  });

  test("matches concatenated 'Brand Name' exactly", () => {
    const m = resolvePaintByName(CATALOG, "Citadel Mephiston Red");
    expect(m?.id).toBe("p1");
  });

  test("falls back to substring on name when no exact match", () => {
    const m = resolvePaintByName(CATALOG, "Sunz");
    expect(m?.id).toBe("p3");
  });

  test("returns null when nothing matches", () => {
    expect(resolvePaintByName(CATALOG, "Antarctic Banana")).toBeNull();
  });
});

describe("WheelClient — R7-004 mount wiring", () => {
  const src = read("src/components/tools/wheel/WheelClient.tsx");

  test("reads `?hex=` via useSearchParams", () => {
    expect(src).toContain('searchParams?.get("hex")');
  });

  test("keeps `?name=` as a soft fallback", () => {
    expect(src).toContain('searchParams?.get("name")');
  });

  test("seeds primary HSL from the hex via hexToHsl", () => {
    expect(src).toContain("hexToHsl(initialHex)");
    expect(src).toContain("hue: hsl.h, saturation: hsl.s");
  });

  test("seeds the lightness slider from the hex's L*", () => {
    expect(src).toContain("Math.round(hsl.l)");
  });

  test("uses resolvePaintByName to translate `?name=` via the loaded catalog", () => {
    expect(src).toContain("resolvePaintByName(rows, initialName)");
  });

  test("guards the name-resolution path with a ref so it only seeds once", () => {
    expect(src).toContain("seededFromName");
  });
});

describe("WishlistToolsMenu — R7-004 docblock still accurate", () => {
  const src = read("src/components/wishlist/WishlistToolsMenu.tsx");

  test("docblock notes the wheel side reads `?hex=` canonically", () => {
    expect(src).toContain("`?hex=` as the canonical pre-seed param");
  });

  test("still sends `?${qs}` with name in the query string", () => {
    expect(src).toContain('new URLSearchParams({ name: paintTitle })');
  });
});
