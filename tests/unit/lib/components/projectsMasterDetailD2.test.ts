/**
 * FOCUS-DASH (2026-06-04) — supersedes the D2 `/projects` master-detail
 * workspace contract.
 *
 * D2 split /projects into a two-pane workspace (table left + a
 * Detail/Focus inspector right on desktop, collapsed disclosures on
 * mobile). The IA restructure intentionally unwinds that: /projects is the
 * DASHBOARD — a full-width PROJECTS table, the relocated planner widgets,
 * and the recipes table beneath. Rows still navigate to the project page.
 *
 * This pins the DASHBOARD shell so a future refactor can't drag the
 * master-detail split back in.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("FOCUS-DASH — DASHBOARD full-width PROJECTS table", () => {
  const wrapper = read("src/components/projects/DashboardProjectsTable.tsx");

  test("is a client component owning the filter state only", () => {
    expect(wrapper).toMatch(/^"use client";/);
    expect(wrapper).toMatch(/useState\(""\)/); // filter query
  });

  test("renders the single-owner ProjectsDashboardTable (no inspector pane)", () => {
    expect(wrapper).toContain("ProjectsDashboardTable");
    // The master-detail inspector + two-pane grid are gone.
    expect(wrapper).not.toContain("ProjectInspector");
    expect(wrapper).not.toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_380px\]/);
  });

  test("keeps the name/faction filter (the one workspace affordance worth saving)", () => {
    expect(wrapper).toMatch(/r\.name\.toLowerCase\(\)\.includes\(q\)/);
    expect(wrapper).toMatch(/r\.faction/);
  });

  test("no row-driven selection plumbing (rows navigate to the project page)", () => {
    expect(wrapper).not.toContain("onSelectProject");
    expect(wrapper).not.toContain("setSelectedId");
    expect(wrapper).not.toContain("selectedId=");
  });
});

describe("FOCUS-DASH — table rows navigate to the project page", () => {
  const table = read("src/components/ProjectsDashboardTable.tsx");

  test("select-to-swap plumbing is absent from the table", () => {
    expect(table).not.toContain("onSelectProject");
    expect(table).not.toMatch(/selectedId/);
    expect(table).not.toMatch(/aria-selected/);
  });

  test("row click opens the inspector deep-link (guarded against controls)", () => {
    // FIGMA-REBUILD §9 — detail is now a slide-out inspector. A guarded row
    // click pushes the `?project=<id>` deep-link (which opens the panel)
    // instead of routing to a standalone detail page.
    expect(table).toMatch(
      /router\.push\(`\/projects\?project=\$\{encodeURIComponent\(row\.id\)\}`\)/,
    );
    expect(table).toContain("isInteractiveTarget");
  });

  test("project Name stays a real link to /projects/[id] (redirects to the inspector)", () => {
    // The Name keeps a real, deep-linkable href; the /projects/[id] route
    // 308s into /projects?project=<id> so the inspector opens.
    expect(table).toMatch(/href=\{`\/projects\/\$\{row\.id\}`\}/);
  });
});

describe("FOCUS-DASH — /projects page is the DASHBOARD", () => {
  const page = read("src/app/projects/page.tsx");

  test("title reads DASHBOARD; the projects table is titled PROJECTS", () => {
    // FIGMA-REBUILD §2 — the page-top title is rendered through the shared
    // PageHeader primitive (which owns the single PixelSplitter <h1>), not
    // an inline <h1> in the page. The PROJECTS Card sits in the table+rail
    // grid, so match the title across whitespace.
    expect(page).toContain("<PageHeader");
    expect(page).toMatch(/title="DASHBOARD"/);
    expect(page).toMatch(/<Card\s+title="PROJECTS"/);
  });

  test("renders the full-width DashboardProjectsTable (not the workspace)", () => {
    expect(page).toContain("DashboardProjectsTable");
    expect(page).not.toContain("ProjectsWorkspace");
  });

  test("width-caps with .content-cap (no ad-hoc max-w-7xl)", () => {
    expect(page).toContain("content-cap");
    const noComments = page
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    expect(noComments).not.toContain("max-w-7xl");
  });

  test("mounts the relocated planner widgets (recipes table removed)", () => {
    // DASH-RECIPES (2026-06-05) — the dashboard recipes table moved to
    // /recipes as the single primary surface; the dashboard keeps the
    // relocated planner widget row but no longer renders the recipes table.
    expect(page).toContain("DashboardWidgets");
    expect(page).not.toContain("DashboardRecipesTable");
  });
});
