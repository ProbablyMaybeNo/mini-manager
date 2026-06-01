/**
 * P14.2 — PLANNER section scaffold.
 *
 * Pins the section into /projects between FOCUS + the dashboard
 * table, asserts the "PLANNER" label is locked, and verifies every
 * empty-state copy line Ross signed off on renders so the section
 * reads as intentional rather than half-built. Each cell is a
 * sibling component the widget builders (P14.3–7) will replace
 * without touching the page wiring — the tests here pin the
 * scaffold shape so that replacement is safe.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("Dashboard PLANNER section scaffold (P14.2)", () => {
  const page = read("src/app/projects/page.tsx");

  test("mounts the PlannerSection composite on /projects", () => {
    expect(page).toContain("PlannerSection");
    expect(page).toMatch(/<PlannerSection\s*\/>/);
  });

  test("PLANNER section sits BELOW FOCUS and ABOVE the dashboard table", () => {
    const focusIdx = page.indexOf('title="FOCUS"');
    const plannerIdx = page.indexOf("<PlannerSection");
    const tableIdx = page.indexOf("<ProjectsDashboardTable");
    expect(focusIdx).toBeGreaterThan(-1);
    expect(plannerIdx).toBeGreaterThan(-1);
    expect(tableIdx).toBeGreaterThan(-1);
    expect(focusIdx).toBeLessThan(plannerIdx);
    expect(plannerIdx).toBeLessThan(tableIdx);
  });

  describe("PlannerSection composite", () => {
    const section = read("src/components/planner/PlannerSection.tsx");

    test("renders a Card with the locked 'PLANNER' label", () => {
      expect(section).toMatch(/title=["']PLANNER["']/);
    });

    test("mounts every cell component the widget builders will replace", () => {
      for (const cell of [
        "PlannerCalendarCell",
        "PlannerActivityCell",
        "PlannerStreakCell",
        "PlannerHeatmapCell",
        "PlannerInspoCell",
      ]) {
        expect(section).toContain(cell);
      }
    });

    test("uses a responsive two-column grid (single stack on mobile, 5-col on md+)", () => {
      // Single-column on mobile, 5 cols on md+ with calendar taking 3
      // and the right column 2.
      expect(section).toContain("grid-cols-1");
      expect(section).toContain("md:grid-cols-5");
      expect(section).toContain("md:col-span-3");
      expect(section).toContain("md:col-span-2");
    });
  });

  describe("PLANNER cell empty-state copy", () => {
    test("Calendar cell shows friendly placeholder", () => {
      const src = read("src/components/planner/PlannerCalendarCell.tsx");
      expect(src).toMatch(/Your painting calendar/);
      expect(src).toMatch(/Add an event to start/);
    });

    test("Activity cell shows friendly placeholder", () => {
      const src = read("src/components/planner/PlannerActivityCell.tsx");
      expect(src).toMatch(/No activity yet/);
      expect(src).toMatch(/Bump a stage or create a recipe/);
    });

    test("Streak cell shows a tight '0 days' placeholder counter", () => {
      const src = read("src/components/planner/PlannerStreakCell.tsx");
      expect(src).toMatch(/\b0\b/);
      expect(src).toMatch(/days/i);
    });

    test("Heatmap cell shows a placeholder 30-day strip", () => {
      const src = read("src/components/planner/PlannerHeatmapCell.tsx");
      // Inline grid-template-columns sets the 30-cell strip.
      expect(src).toContain("repeat(30");
      expect(src).toMatch(/last 30 days/i);
    });

    test("Inspo cell shows the locked paste-only copy", () => {
      const src = read("src/components/planner/PlannerInspoCell.tsx");
      expect(src).toMatch(/Pinterest, Instagram, or ArtStation/);
      expect(src).toMatch(/reference board/);
    });
  });

  describe("PLANNER scaffold discipline", () => {
    const files = [
      "src/components/planner/PlannerSection.tsx",
      "src/components/planner/PlannerCalendarCell.tsx",
      "src/components/planner/PlannerActivityCell.tsx",
      "src/components/planner/PlannerStreakCell.tsx",
      "src/components/planner/PlannerHeatmapCell.tsx",
      "src/components/planner/PlannerInspoCell.tsx",
    ];

    test("no scaffold cell uses raw hex literals (forces @theme tokens)", () => {
      // 3/6/8-char hex literals OUTSIDE a `data-*` or comment context.
      // The scaffold should lean on var(--color-…) tokens.
      const hexLiteral = /#[0-9a-fA-F]{3,8}\b/;
      for (const rel of files) {
        const src = read(rel);
        // Strip line comments + block comments so we don't trip on
        // P14.2 mentions etc. that aren't actually rendered.
        const noComments = src
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/(^|\s)\/\/[^\n]*/g, "$1");
        expect(noComments, `raw hex found in ${rel}`).not.toMatch(hexLiteral);
      }
    });

    test("no scaffold cell uses cyan on an action button (P13.1)", () => {
      // No Button variant="cyan" / className referencing cyan on a
      // Button element — there are no Button elements in the scaffold
      // at all, but we pin the rule against it.
      for (const rel of files) {
        const src = read(rel);
        expect(src).not.toMatch(/<Button[^>]+cyan/);
      }
    });

    test("no scaffold cell uses bracketed [ ] labels in headings (P13.1)", () => {
      // Solid-fill Button discipline: no `[ FOO ]` brackets around
      // action-button-style labels. The scaffold has no buttons yet,
      // but the locked headings ("PLANNER", "CALENDAR", "ACTIVITY"
      // etc.) should be bare strings.
      for (const rel of files) {
        const src = read(rel);
        expect(src).not.toMatch(/\[\s*[A-Z][A-Z\s]*\s*\]/);
      }
    });
  });
});
