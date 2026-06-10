/**
 * COLLECTION surface (FIGMA-REBUILD §8).
 *
 * `/collection` replaces `/collections` and `/wishlist` (redirects).
 * New `.dt` tables live under `src/components/collection/`.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("Collection page", () => {
  const src = read("src/app/collection/page.tsx");

  test("renders both collection tables from the new module", () => {
    expect(src).toContain("@/components/collection/PaintCollectionTable");
    expect(src).toContain("@/components/collection/ModelCollectionTable");
    expect(src).toContain("<PaintCollectionTable");
    expect(src).toContain("<ModelCollectionTable");
  });

  test("uses PageHeader with yellow COLLECTION accent", () => {
    expect(src).toContain("PageHeader");
    expect(src).toContain('accent="yellow"');
    expect(src).toContain('title="COLLECTION"');
  });

  test("header add bar is AddUrlBar", () => {
    expect(src).toContain("AddUrlBar");
  });

  test("partitions paint vs model via collection queries", () => {
    expect(src).toContain("listPaintCollection");
    expect(src).toContain("listModelCollection");
  });
});

describe("Legacy routes redirect to /collection", () => {
  test("/wishlist → /collection", () => {
    const src = read("src/app/wishlist/page.tsx");
    expect(src).toContain('"/collection"');
  });

  test("/collections → /collection", () => {
    const src = read("src/app/collections/page.tsx");
    expect(src).toContain('"/collection"');
  });
});

describe("Paint collection table (FIGMA)", () => {
  const src = read("src/components/collection/PaintCollectionTable.tsx");

  test("uses .dt idiom with required columns", () => {
    expect(src).toContain('className="dt"');
    for (const col of ["Name", "Company", "Vendor", "Price", "Recipe", "Status", "Link"]) {
      expect(src).toContain(col);
    }
  });

  test("row selection + REMOVE PAINT footer", () => {
    expect(src).toContain("TableActions");
    expect(src).toContain("REMOVE PAINT");
  });
});

describe("Model collection table (FIGMA)", () => {
  const src = read("src/components/collection/ModelCollectionTable.tsx");

  test("PROJECT assign dropdown present", () => {
    expect(src).toContain("ProjectAssign");
  });
});
