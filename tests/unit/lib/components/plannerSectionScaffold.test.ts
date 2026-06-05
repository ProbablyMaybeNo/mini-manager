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

describe("DASHBOARD planner-widget row (FOCUS-DASH)", () => {
  const page = read("src/app/projects/page.tsx");
  const widgets = read("src/components/dashboard/DashboardWidgets.tsx");

  test("the DASHBOARD mounts the planner-widget row below the table", () => {
    // FOCUS-DASH — the planner cells (activity/streak/calendar) MOVED from
    // the FOCUS screen to the DASHBOARD, composed by DashboardWidgets.
    expect(page).toContain("DashboardWidgets");
    expect(page).toMatch(/<DashboardWidgets calYear=\{calYear\} calMonth=\{calMonth\}/);
  });

  test("the widget row mounts after the project table (calendar after the table)", () => {
    // Order by JSX usage, not import order. DASH-RECIPES (2026-06-05) —
    // the dashboard recipes table was removed; the widget row is now the
    // last major section above RecentlyBoughtLine.
    const tableIdx = page.indexOf("<DashboardProjectsTable");
    const widgetsIdx = page.indexOf("<DashboardWidgets");
    expect(tableIdx).toBeGreaterThan(-1);
    expect(widgetsIdx).toBeGreaterThan(tableIdx);
    // The dashboard recipes table is gone from the page.
    expect(page).not.toContain("<DashboardRecipesTable");
  });

  describe("DashboardWidgets composite", () => {
    test("reuses the three relocated planner cells (no rebuild)", () => {
      for (const cell of [
        "PlannerCalendarCell",
        "PlannerActivityCell",
        "PlannerStreakCell",
      ]) {
        expect(widgets).toContain(cell);
      }
    });

    test("the inspo board is NOT here — it left for the FOCUS screen", () => {
      expect(widgets).not.toContain("PlannerInspoCell");
    });

    test("threads calYear / calMonth to the calendar cell only", () => {
      expect(widgets).toMatch(
        /<PlannerCalendarCell\s+calYear=\{calYear\}\s+calMonth=\{calMonth\}/,
      );
    });

    test("uses a responsive grid (single stack on mobile, 3-col on md+)", () => {
      expect(widgets).toContain("grid-cols-1");
      expect(widgets).toContain("md:grid-cols-3");
    });

    test("DASH-PROPORTION: calendar is the wide, tall column; streak/activity stack beside it", () => {
      // The calendar widens to span 2 of the 3 columns AND both rows, so
      // it's the tall column. Streak + Activity each occupy the single
      // narrow left column, stacked (row 1 / row 2) so the two shorter
      // widgets together match the calendar's height — the trio reads as
      // one rectangle.
      expect(widgets).toMatch(
        /md:col-start-2 md:col-span-2 md:row-start-1 md:row-span-2[\s\S]*?<PlannerCalendarCell/,
      );
      expect(widgets).toMatch(
        /md:col-start-1 md:row-start-1[\s\S]*?<PlannerStreakCell/,
      );
      expect(widgets).toMatch(
        /md:col-start-1 md:row-start-2[\s\S]*?<PlannerActivityCell/,
      );
      // Even halves on the left so Streak doesn't float in a large empty
      // box and the stack height tracks the calendar.
      expect(widgets).toContain("md:auto-rows-fr");
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

    // LIB-COLORMAP — the COLLECTION colour-map cell moved to /library, so
    // the planner no longer renders the spectrum grid. Its surface is now
    // pinned by the CollectionPanel contract in libraryColorMap.test.ts.

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
