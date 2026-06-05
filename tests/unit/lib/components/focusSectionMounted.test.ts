/**
 * FOCUS-DASH (2026-06-04) — the FOCUS bench lives on the FOCUS screen.
 *
 * Supersedes the P13.11 / D2 "FOCUS section on /projects" contract: the
 * IA restructure moved the FOCUS bench (FocusPicker + FocusPanel +
 * Stopwatch) off the projects DASHBOARD and onto the /planner FOCUS
 * screen. This pins the new wiring so a future refactor can't quietly
 * drag the bench back onto the dashboard or drop the locked "FOCUS" label.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("FOCUS bench lives on the FOCUS screen (FOCUS-DASH)", () => {
  const focus = read("src/app/planner/page.tsx");
  const dashboard = read("src/app/projects/page.tsx");

  test("the FOCUS screen mounts FocusPicker + FocusPanel + Stopwatch", () => {
    expect(focus).toContain("FocusPicker");
    expect(focus).toContain("FocusPanel");
    expect(focus).toContain("Stopwatch");
  });

  test("the FOCUS screen draws the locked 'FOCUS' Card label", () => {
    expect(focus).toMatch(/<Card[^>]*title="FOCUS"/s);
  });

  test("reads focus state via the dedicated query helpers (not bespoke SQL)", () => {
    expect(focus).toContain("listFocusCandidates");
    expect(focus).toContain("getFocusedRecipeBundle");
  });

  test("provides an empty-state message when no focus is set", () => {
    expect(focus).toContain("FocusEmptyState");
    expect(focus).toMatch(/Pick a project to focus on/);
  });

  test("the DASHBOARD no longer carries the FOCUS bench", () => {
    // The bench left for /planner — the dashboard is the project table +
    // planner widgets + recipes, no FocusPicker / FocusPanel / Stopwatch.
    expect(dashboard).not.toContain("FocusPicker");
    expect(dashboard).not.toContain("FocusPanel");
    expect(dashboard).not.toContain("Stopwatch");
  });
});
