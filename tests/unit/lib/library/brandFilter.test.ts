/**
 * P12.21 — Brand filter is a flat scrollable checkbox list.
 *
 * Drop the A-Z fold that used to compress > 12 brands into per-letter
 * sub-sections. Ross's brief: simpler reading, easier scroll, default
 * all checked (the persistent default arrives via P12.19).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

describe("FilterRail brand picker (P12.21)", () => {
  const src = read("src/components/library/FilterRail.tsx");

  test("brandCollapse is always false — A-Z fold retired", () => {
    expect(src).toMatch(/const brandCollapse = false/);
  });

  test("FlatBrandList still exists for the always-flat render", () => {
    expect(src).toContain("FlatBrandList");
  });

  test("the flat list scrolls inside a bounded max-h", () => {
    expect(src).toMatch(/max-h-64/);
  });

  test("CollapsibleBrandList stays in the file as dead code (in case Ross flips it back)", () => {
    // Not a strong requirement, but keeping it means the toggle is a
    // one-line revert if the brand catalog explodes past UI tolerance.
    expect(src).toContain("CollapsibleBrandList");
  });

  test("docstring mentions the flat list explicitly", () => {
    expect(src).toMatch(/flat scrollable checkbox/);
  });
});
