/**
 * D2 — `/projects` master-detail workspace.
 *
 * Static source-scan net (mirrors densityFoundations / plannerRouteD6)
 * for the D2 acceptance under the locked Decisions (2026-06-03 §2):
 *
 *   - Two-pane master-detail at ≥1024: left = filter + project table;
 *     right = project-detail inspector with a Detail / Focus tab.
 *   - Selecting a project swaps the inspector WITHOUT navigation (the
 *     table's Name becomes a select button, the workspace owns selectedId).
 *   - The FOCUS bench is the inspector's Focus tab, NOT the default home
 *     state (Detail is default).
 *   - PLANNER is NOT on desktop /projects — it leaves to the /planner
 *     route (D6); only the mobile single-pane keeps the collapsed PLANNER.
 *   - Single owner of the table (no double-mount across breakpoints) via a
 *     true conditional mount, so the inactive layout adds zero nodes
 *     (keeps the <300 interactive-node budget).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("D2 — ProjectsWorkspace master-detail", () => {
  const workspace = read("src/components/projects/ProjectsWorkspace.tsx");

  test("is a client component owning selection + filter state", () => {
    expect(workspace).toMatch(/^"use client";/);
    expect(workspace).toMatch(/useState<string \| null>/); // selectedId
    expect(workspace).toMatch(/useState\(""\)/); // filter query
  });

  test("desktop ≥1024: two-pane grid (table left + inspector right)", () => {
    expect(workspace).toMatch(/matchMedia\("\(min-width: 1024px\)"\)/);
    expect(workspace).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_380px\]/);
    expect(workspace).toContain("ProjectInspector");
  });

  test("table is selectable on desktop (select-to-swap without navigation)", () => {
    expect(workspace).toMatch(/selectedId=\{selectedId\}/);
    expect(workspace).toMatch(/onSelectProject=\{setSelectedId\}/);
  });

  test("single owner: the table is conditionally mounted, never double-rendered via CSS hidden", () => {
    // The breakpoint branch is `if (isDesktop) return (...)` then a mobile
    // return — a true conditional mount, not two CSS-hidden copies.
    expect(workspace).toMatch(/if \(isDesktop\) \{/);
  });

  test("mobile single-pane: table only is selection-free (Name navigates)", () => {
    // The mobile <ProjectsDashboardTable> omits selectedId/onSelectProject
    // so the Name stays a link. Assert the desktop branch is the only one
    // wiring selection by counting onSelectProject usages = 1.
    const selectMatches = workspace.match(/onSelectProject=/g) ?? [];
    expect(selectMatches.length).toBe(1);
  });

  test("PLANNER is NOT in the desktop branch — only the mobile collapsed pane", () => {
    // plannerSection prop is consumed only in the mobile branch's
    // CollapsibleSection; the desktop branch renders the inspector instead.
    const desktopStart = workspace.indexOf("if (isDesktop)");
    const mobileStart = workspace.lastIndexOf("Mobile single pane");
    expect(desktopStart).toBeGreaterThan(-1);
    expect(mobileStart).toBeGreaterThan(desktopStart);
    const desktopBranch = workspace.slice(desktopStart, mobileStart);
    expect(desktopBranch).not.toContain("plannerSection");
    expect(desktopBranch).not.toMatch(/title="PLANNER"/);
  });
});

describe("D2 — ProjectInspector (Detail / Focus tab)", () => {
  const inspector = read("src/components/projects/ProjectInspector.tsx");

  test("Detail is the default tab; Focus is the opt-in bench tab", () => {
    expect(inspector).toMatch(/useState<InspectorTab>\("detail"\)/);
  });

  test("exposes a real tablist with two tabs", () => {
    expect(inspector).toMatch(/role="tablist"/);
    expect(inspector).toMatch(/role="tab"/);
    expect(inspector).toMatch(/role="tabpanel"/);
  });

  test("Detail renders the selected project's status/completion/palette/models", () => {
    expect(inspector).toMatch(/StatusPill/);
    expect(inspector).toMatch(/ProgressBar/);
    expect(inspector).toMatch(/totalModels/);
    expect(inspector).toMatch(/paletteHexes/);
  });

  test("Detail offers an Open-full-project link for the deep drill", () => {
    expect(inspector).toMatch(/href=\{`\/projects\/\$\{row\.id\}`\}/);
  });

  test("tabs are reskinned OFF cyan (amber active) per the locked palette", () => {
    expect(inspector).toMatch(/border-\[var\(--color-amber\)\]/);
    expect(inspector).not.toMatch(/segment-active/); // not the cyan SegmentedControl
  });
});

describe("D2 — table selection plumbing", () => {
  const table = read("src/components/ProjectsDashboardTable.tsx");

  test("table accepts optional selectedId + onSelectProject props", () => {
    expect(table).toMatch(/selectedId\?:\s*string \| null/);
    expect(table).toMatch(/onSelectProject\?:\s*\(id: string\) => void/);
  });

  test("desktop Name becomes a select button when onSelectProject is set", () => {
    expect(table).toMatch(/onClick=\{\(\) => onSelectProject\(row\.id\)\}/);
  });

  test("selected row is highlighted off cyan (amber tint), aria-selected set", () => {
    expect(table).toMatch(/var\(--color-amber\)_10%/);
    expect(table).toMatch(/aria-selected=\{onSelectProject \? selected : undefined\}/);
  });
});

describe("D2 — /projects page uses the workspace + content-cap", () => {
  const page = read("src/app/projects/page.tsx");

  test("renders ProjectsWorkspace instead of stacking five surfaces", () => {
    expect(page).toContain("ProjectsWorkspace");
  });

  test("width-caps with .content-cap (replaces ad-hoc max-w-7xl)", () => {
    expect(page).toContain("content-cap");
    // No max-w-7xl in a className (the only mention left is the rationale
    // comment) — strip comments before asserting.
    const noComments = page
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    expect(noComments).not.toContain("max-w-7xl");
  });

  test("seeds the inspector selection with the focused project", () => {
    expect(page).toMatch(/initialSelectedId=\{focusBundle\?\.project\.id \?\? null\}/);
  });
});
