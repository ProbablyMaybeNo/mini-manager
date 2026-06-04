/**
 * D6 — `/planner` single-screen dashboard route.
 *
 * Static source-scan net (mirrors densityFoundations / plannerSectionScaffold
 * — node env, fs.readFileSync, no DOM / dev server) for the D6 route surface:
 *
 *   1. The `app/planner` route exists and mounts the SHARED `PlannerSection`
 *      cluster (not a forked copy of the widgets).
 *   2. It threads `?calYear` / `?calMonth` to the cluster exactly as
 *      `src/app/projects/page.tsx` does (awaited searchParams promise →
 *      array-narrowed → passed as props).
 *   3. It width-caps with the D1 `.content-cap` utility.
 *   4. The NavRail surfaces a `/planner` link (desktop nav).
 *   5. Discipline: no raw hex literals, no cyan action buttons.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("D6 — /planner route", () => {
  const page = read("src/app/planner/page.tsx");

  test("mounts the shared PlannerSection cluster", () => {
    expect(page).toContain("PlannerSection");
    expect(page).toMatch(/<PlannerSection\s+calYear=\{calYear\}\s+calMonth=\{calMonth\}/);
  });

  test("threads ?calYear / ?calMonth from awaited searchParams, like /projects", () => {
    // Same App-Router contract as the projects page: searchParams is an
    // awaited promise, each value array-narrowed before use.
    expect(page).toMatch(/searchParams\?:\s*Promise<Record</);
    expect(page).toMatch(/const params = \(await searchParams\) \?\? \{\}/);
    expect(page).toMatch(/Array\.isArray\(calYearRaw\)\s*\?\s*calYearRaw\[0\]\s*:\s*calYearRaw/);
    expect(page).toMatch(/Array\.isArray\(calMonthRaw\)\s*\?\s*calMonthRaw\[0\]\s*:\s*calMonthRaw/);
  });

  test("width-caps with the D1 .content-cap utility", () => {
    expect(page).toContain("content-cap");
  });

  test("is force-dynamic (self-fetching cluster reads per-user data)", () => {
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

describe("D6 — NavRail surfaces /planner", () => {
  const navRail = read("src/components/NavRail.tsx");

  test("PRIMARY nav includes a /planner link labelled Planner", () => {
    expect(navRail).toMatch(/href:\s*"\/planner"[\s\S]{0,80}label:\s*"Planner"/);
  });
});
