/**
 * FOCUS-DASH (2026-06-04) — `/planner` is the FOCUS painting screen.
 *
 * Supersedes the D6 "/planner = PLANNER dashboard cluster" contract: the
 * IA restructure turned this route into the FOCUS bench (the calendar /
 * activity / streak cells MOVED to the DASHBOARD on /projects). The path
 * stays `/planner` to limit typed-route churn; the NavRail label + page
 * H1 are retitled FOCUS.
 *
 * Static source-scan net (node env, fs.readFileSync, no DOM / dev server)
 * for the FOCUS route surface:
 *
 *   1. The `app/planner` route mounts the FOCUS bench primitives
 *      (FocusPicker + FocusPanel + Stopwatch) + the reused inspo board —
 *      NOT the PlannerSection planner cluster.
 *   2. It self-fetches the focus data via the dedicated query helpers.
 *   3. The page H1 reads "FOCUS".
 *   4. It width-caps with the D1 `.content-cap` utility + is force-dynamic.
 *   5. The NavRail surfaces the `/planner` link relabelled "Focus".
 *   6. Discipline: no raw hex literals, no cyan action buttons.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("FOCUS-DASH — /planner is the FOCUS screen", () => {
  const page = read("src/app/planner/page.tsx");

  test("mounts the FOCUS bench primitives, not the planner cluster", () => {
    expect(page).toContain("FocusPicker");
    expect(page).toContain("FocusPanel");
    expect(page).toContain("Stopwatch");
    // The planner widget cluster (calendar/activity/streak) is gone — it
    // moved to the DASHBOARD on /projects.
    expect(page).not.toContain("PlannerSection");
    expect(page).not.toContain("PlannerCalendarCell");
    expect(page).not.toContain("PlannerActivityCell");
    expect(page).not.toContain("PlannerStreakCell");
  });

  test("reuses the inspo board (PlannerInspoCell) as the 4th section", () => {
    expect(page).toContain("PlannerInspoCell");
  });

  test("self-fetches focus state via the dedicated query helpers", () => {
    expect(page).toContain("listFocusCandidates");
    expect(page).toContain("getFocusedRecipeBundle");
    expect(page).toContain("buildFocusSlots");
  });

  test("the page H1 reads FOCUS", () => {
    expect(page).toMatch(/<h1[^>]*>\s*FOCUS\s*<\/h1>/);
  });

  test("provides a FOCUS empty-state when no project is focused", () => {
    expect(page).toContain("FocusEmptyState");
    expect(page).toMatch(/Pick a project to focus on/);
  });

  test("width-caps with the D1 .content-cap utility", () => {
    expect(page).toContain("content-cap");
  });

  test("is force-dynamic (self-fetching bench reads per-user data)", () => {
    expect(page).toMatch(/export const dynamic = "force-dynamic"/);
  });

  test("no raw hex literals; no cyan action button", () => {
    const noComments = page
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    expect(noComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(page).not.toMatch(/<Button[^>]+cyan/);
  });
});

describe("FOCUS-DASH — NavRail relabels /planner to Focus", () => {
  const navRail = read("src/components/NavRail.tsx");

  test("PRIMARY nav keeps the /planner link, relabelled Focus", () => {
    expect(navRail).toMatch(/href:\s*"\/planner"[\s\S]{0,120}label:\s*"Focus"/);
  });

  test("the old 'Planner' label is gone from the nav", () => {
    expect(navRail).not.toMatch(/label:\s*"Planner"/);
  });
});
