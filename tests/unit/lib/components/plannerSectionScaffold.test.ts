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
    // P14.3 — PlannerSection takes optional `calYear` / `calMonth`
    // search-param props. D2 — it is also passed `bare` so the mobile
    // disclosure header owns the title. Accept either form.
    expect(page).toMatch(/<PlannerSection(\s+[^>]*)?\s*\/>/);
  });

  test("D2 — the workspace orders the mobile pane table → FOCUS → PLANNER", () => {
    // D2 moved the master-detail composition into ProjectsWorkspace; its
    // mobile single-pane branch renders the table first, then the
    // collapsed FOCUS + PLANNER disclosure sections.
    const workspace = read("src/components/projects/ProjectsWorkspace.tsx");
    const tableIdx = workspace.indexOf("<ProjectsDashboardTable");
    const focusIdx = workspace.indexOf('title="FOCUS"');
    const plannerIdx = workspace.indexOf('title="PLANNER"');
    expect(tableIdx).toBeGreaterThan(-1);
    expect(focusIdx).toBeGreaterThan(-1);
    expect(plannerIdx).toBeGreaterThan(-1);
    expect(focusIdx).toBeLessThan(plannerIdx);
  });

  describe("PlannerSection composite", () => {
    const section = read("src/components/planner/PlannerSection.tsx");

    test("renders a Card with the locked 'PLANNER' label", () => {
      expect(section).toMatch(/title=["']PLANNER["']/);
    });

    test("mounts every cell component the widget builders will replace", () => {
      // LIB-COLORMAP — the COLLECTION colour map moved to /library; the
      // PLANNER no longer mounts HeatSinkGridCell.
      for (const cell of [
        "PlannerCalendarCell",
        "PlannerActivityCell",
        "PlannerStreakCell",
        "PlannerInspoCell",
      ]) {
        expect(section).toContain(cell);
      }
    });

    test("LIB-COLORMAP — the COLLECTION map cell is gone from the planner", () => {
      expect(section).not.toContain("HeatSinkGridCell");
    });

    test("uses a responsive grid (single stack on mobile, 2-col on md+)", () => {
      // LIB-COLORMAP — with the COLLECTION hero gone the grid rebalances
      // to a 2-column desktop layout (4 cells), single stack on mobile.
      expect(section).toContain("grid-cols-1");
      expect(section).toContain("md:grid-cols-2");
      expect(section).toContain("md:col-start-1");
      expect(section).toContain("md:col-start-2");
    });

    test("mobile reorder: Streak > Activity > Calendar > Inspo", () => {
      // Each cell wrapper carries an explicit `order-N` class that
      // controls the mobile (<md) stacking order. Streak first (smallest +
      // most reward-loaded), Activity second (freshest action), Calendar
      // third (the small month widget), Inspo closes the scroll.
      const streakIdx = section.indexOf("order-1");
      const activityIdx = section.indexOf("order-2");
      const calendarIdx = section.indexOf("order-3");
      const inspoIdx = section.indexOf("order-4");
      expect(streakIdx).toBeGreaterThan(-1);
      expect(activityIdx).toBeGreaterThan(-1);
      expect(calendarIdx).toBeGreaterThan(-1);
      expect(inspoIdx).toBeGreaterThan(-1);

      // Tie each order-N class to the right cell by checking the
      // component name follows on the same wrapper div.
      const orderMatch = (cell: string, n: number) => {
        const re = new RegExp(
          `order-${n}[^"]*"[\\s\\S]{0,300}?<${cell}`,
        );
        expect(section, `${cell} should be order-${n}`).toMatch(re);
      };
      orderMatch("PlannerStreakCell", 1);
      orderMatch("PlannerActivityCell", 2);
      orderMatch("PlannerCalendarCell", 3);
      orderMatch("PlannerInspoCell", 4);
    });

    test("desktop order preserved via md:row-start / md:col-start", () => {
      // On md+ each cell pins its grid row + column so the mobile reorder
      // doesn't bleed into the desktop visual. Two rows, two columns.
      expect(section).toContain("md:row-start-1");
      expect(section).toContain("md:row-start-2");
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
