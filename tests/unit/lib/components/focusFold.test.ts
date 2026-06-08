/**
 * FOCUS-FOLD (2026-06-08) — the FOCUS bench folds into the DASHBOARD.
 *
 * Supersedes the FOCUS-DASH contract (standalone `/planner` FOCUS screen +
 * a `/planner` nav item). Ross's locked decision: REMOVE the standalone
 * `/planner` route, drop FOCUS from the nav, and fold the painting bench
 * (TIMER + the focused recipe with per-paint notes + the INSPO board) onto
 * the `/projects` dashboard as a compact section.
 *
 * Static source-scan net (node env, fs.readFileSync, no DOM / dev server)
 * pinning the new wiring so a future refactor can't quietly resurrect the
 * standalone route or re-add the nav item:
 *
 *   1. The `app/planner/page.tsx` route file is GONE.
 *   2. `next.config.ts` permanently redirects `/planner` → `/projects` so
 *      old links don't 404.
 *   3. The bench primitives (FocusPicker + FocusPanel + Stopwatch + the
 *      reused inspo board) live in DashboardFocusSection.
 *   4. The dashboard renders the FOCUS section, anchored at #focus.
 *   5. The NavRail no longer carries a /planner (Focus) item.
 *   6. The BottomTabBar no longer carries a /planner (Focus) tab.
 *   7. The command palette's "Go to Focus" deep-links to the dashboard
 *      FOCUS section, not a dead /planner route.
 *   8. Discipline: the section uses no raw hex literals + no cyan action
 *      button.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}
function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel));
}

describe("FOCUS-FOLD — the standalone /planner route is removed", () => {
  test("the app/planner/page.tsx route file no longer exists", () => {
    expect(exists("src/app/planner/page.tsx")).toBe(false);
  });

  test("next.config permanently redirects /planner → /projects", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toContain("async redirects()");
    expect(cfg).toMatch(/source:\s*"\/planner"/);
    expect(cfg).toMatch(/destination:\s*"\/projects"/);
    expect(cfg).toMatch(/permanent:\s*true/);
  });
});

describe("FOCUS-FOLD — the bench lives in DashboardFocusSection", () => {
  const section = read("src/components/focus/DashboardFocusSection.tsx");

  test("mounts the FOCUS bench primitives", () => {
    expect(section).toContain("FocusPicker");
    expect(section).toContain("FocusPanel");
    expect(section).toContain("Stopwatch");
  });

  test("reuses the inspo board (PlannerInspoCell), not a rebuild", () => {
    expect(section).toContain("PlannerInspoCell");
  });

  test("self-fetches focus state via the dedicated query helpers", () => {
    expect(section).toContain("listFocusCandidates");
    expect(section).toContain("getFocusedRecipeBundle");
    expect(section).toContain("buildFocusSlots");
  });

  test("draws the locked 'FOCUS' Card label + a FOCUS section heading", () => {
    expect(section).toMatch(/<Card[^>]*title="FOCUS"/s);
    expect(section).toMatch(/<h2[^>]*>\s*FOCUS\s*<\/h2>/);
  });

  test("anchors the section at #focus for deep-linking", () => {
    expect(section).toMatch(/id="focus"/);
  });

  test("provides a FOCUS empty-state when no project is focused", () => {
    expect(section).toContain("FocusEmptyState");
    expect(section).toMatch(/Pick a project to focus on/);
  });

  test("the live Stopwatch sits in its own TIMER card", () => {
    expect(section).toMatch(/<Card[^>]*title="TIMER"[\s\S]{0,300}<Stopwatch/);
    expect(section).toContain('techLabel="SYS ▸ TIMER"');
  });

  test("no raw hex literals; no cyan action button", () => {
    const noComments = section
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    expect(noComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(section).not.toMatch(/<Button[^>]+cyan/);
  });
});

describe("FOCUS-FOLD — the dashboard mounts the FOCUS section", () => {
  const page = read("src/app/projects/page.tsx");

  test("renders DashboardFocusSection", () => {
    expect(page).toContain("DashboardFocusSection");
    expect(page).toMatch(/<DashboardFocusSection/);
  });

  test("threads the recipe-tab + active-slot persistence params", () => {
    expect(page).toContain("focusRecipeId={focusRecipeId}");
    expect(page).toContain("focusSlotParam={focusSlotParam}");
  });

  test("the FOCUS section sits below the table/widget grid, above spend", () => {
    const widgetsIdx = page.indexOf("<DashboardWidgets");
    const focusIdx = page.indexOf("<DashboardFocusSection");
    const spendIdx = page.indexOf("<RecentlyBoughtLine");
    expect(widgetsIdx).toBeGreaterThan(-1);
    expect(focusIdx).toBeGreaterThan(widgetsIdx);
    expect(spendIdx).toBeGreaterThan(focusIdx);
  });
});

describe("FOCUS-FOLD — the nav drops the FOCUS item", () => {
  test("the NavRail no longer carries a /planner (Focus) item", () => {
    const navRail = read("src/components/NavRail.tsx");
    expect(navRail).not.toMatch(/href:\s*"\/planner"/);
    expect(navRail).not.toMatch(/label:\s*"Focus"/);
    expect(navRail).not.toMatch(/label:\s*"Planner"/);
  });

  test("the BottomTabBar no longer carries a /planner (Focus) tab", () => {
    const tabBar = read("src/components/BottomTabBar.tsx");
    expect(tabBar).not.toMatch(/href:\s*"\/planner"/);
    expect(tabBar).not.toMatch(/label:\s*"Focus"/);
  });

  test("the command palette 'Go to Focus' deep-links to the dashboard section", () => {
    const search = read("src/components/search/GlobalSearch.tsx");
    expect(search).toMatch(/label: "Go to Focus"/);
    expect(search).toContain('href: "/projects#focus"');
    expect(search).not.toContain('href: "/planner"');
  });
});
