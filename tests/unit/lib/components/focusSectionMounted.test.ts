/**
 * P13.11 — FOCUS section sits above the main dashboard table.
 *
 * Pins the wiring on /projects so a future refactor can't quietly
 * relocate the FOCUS section below the table or drop the locked
 * "FOCUS" label Ross signed off on.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("Dashboard FOCUS section (P13.11)", () => {
  const src = read("src/app/projects/page.tsx");

  test("mounts the FocusPicker + FocusPanel components", () => {
    expect(src).toContain("FocusPicker");
    expect(src).toContain("FocusPanel");
  });

  test("renders a Card with the locked 'FOCUS' label", () => {
    expect(src).toMatch(/title=["']FOCUS["']/);
  });

  test("FOCUS section sits ABOVE the ProjectsDashboardTable", () => {
    const focusIdx = src.indexOf('title="FOCUS"');
    // Find the *JSX usage* of ProjectsDashboardTable (the `<` form),
    // not the bare identifier in the import statement at the top.
    const tableIdx = src.indexOf("<ProjectsDashboardTable");
    expect(focusIdx).toBeGreaterThan(-1);
    expect(tableIdx).toBeGreaterThan(-1);
    expect(focusIdx).toBeLessThan(tableIdx);
  });

  test("reads focus state via the dedicated query helpers (not bespoke SQL)", () => {
    expect(src).toContain("listFocusCandidates");
    expect(src).toContain("getFocusedRecipeBundle");
  });

  test("provides an empty-state message when no focus is set", () => {
    expect(src).toContain("FocusEmptyState");
    expect(src).toMatch(/Pick a project to focus on/);
  });
});
