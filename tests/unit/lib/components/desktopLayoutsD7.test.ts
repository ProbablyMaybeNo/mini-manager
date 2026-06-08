/**
 * D7 — Wishlist & user as desktop layouts.
 *
 * Source-scan net for the D7 layout deliverables [DESKTOP §D7]:
 *   - Wishlist: persistent left filter rail at ≥1024 (single column below).
 *   - User: two-column settings grid at ≥1024, width-capped; the brand
 *     filter is collapsible (M2).
 *   - Pricing: multi-column tiers, width-capped with .content-cap.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

// COLLECTIONS rebuild — the persistent left filter rail was replaced by a
// per-table Filter button at the far right of each table's header row, so
// the same filters work identically on desktop + mobile (no separate rail
// / header-disclosure split).
describe("Collections — per-table filter button layout", () => {
  const page = read("src/app/collections/page.tsx");
  const filter = read("src/components/collections/TableFilter.tsx");

  test("each table header row carries its own Filter button", () => {
    expect(page).toContain("<TableFilter");
    // Two instances — paint + model.
    expect(page.split("<TableFilter").length - 1).toBeGreaterThanOrEqual(2);
  });

  test("the filter button opens a small panel of that table's filters", () => {
    expect(filter).toContain('role="dialog"');
    expect(filter).toContain("groups");
  });

  test("no persistent left rail aside remains", () => {
    expect(page).not.toMatch(/<aside className="hidden lg:block w-\[220px\]/);
  });
});

describe("D7 — user two-column settings", () => {
  const page = read("src/app/user/page.tsx");

  test("width-capped with .content-cap (replaces max-w-3xl)", () => {
    expect(page).toContain("content-cap");
    const noComments = page
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    expect(noComments).not.toContain("max-w-3xl");
  });

  test("settings cards flow into two columns at ≥1024", () => {
    expect(page).toMatch(/grid grid-cols-1 lg:grid-cols-2 gap-8/);
  });

  test("brand filter is collapsible (M2 disclosure, reused here)", () => {
    const brandCard = read("src/components/user/LibraryBrandFilterCard.tsx");
    expect(brandCard).toMatch(/setListOpen/);
    expect(brandCard).toMatch(/aria-expanded=\{listOpen\}/);
  });
});

describe("D7 — pricing width cap", () => {
  const page = read("src/app/pricing/page.tsx");

  test("multi-column tiers, capped with .content-cap (not max-w-6xl)", () => {
    expect(page).toContain("content-cap");
    const noComments = page
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    expect(noComments).not.toContain("max-w-6xl mx-auto");
    expect(page).toMatch(/xl:grid-cols-4|md:grid-cols-3/);
  });
});
