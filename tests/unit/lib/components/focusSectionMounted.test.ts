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

describe("Dashboard FOCUS section (P13.11 / D2)", () => {
  const src = read("src/app/projects/page.tsx");
  // D2 — FOCUS is now built once on the page as the `focusBench` node and
  // handed to ProjectsWorkspace: the inspector's Focus tab on desktop, the
  // collapsed FOCUS disclosure on mobile.
  const workspace = read("src/components/projects/ProjectsWorkspace.tsx");
  const inspector = read("src/components/projects/ProjectInspector.tsx");

  test("mounts the FocusPicker + FocusPanel components (focusBench node)", () => {
    expect(src).toContain("FocusPicker");
    expect(src).toContain("FocusPanel");
  });

  test("the focusBench is wired into the workspace", () => {
    expect(src).toMatch(/focusBench=\{focusBench\}/);
    expect(workspace).toContain("focusBench");
  });

  test("desktop: FOCUS bench is the inspector's Focus tab (not default)", () => {
    // Detail is the default home state; Focus is the opt-in bench tab.
    expect(inspector).toMatch(/useState<InspectorTab>\("detail"\)/);
    expect(inspector).toMatch(/focusTab/);
  });

  test("mobile: FOCUS is a collapsed disclosure with the locked label", () => {
    expect(workspace).toMatch(/<CollapsibleSection[^>]*title="FOCUS"/s);
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
