/**
 * D2 — `/projects` master-detail workspace.
 *
 * Static source-scan net (mirrors densityFoundations / plannerRouteD6)
 * for the D2 shell + the 2026-06 walkthrough UX refinement:
 *
 *   - Two-pane workspace at ≥1024: left = filter + project table; right =
 *     project-detail inspector with a Detail / Focus tab.
 *   - UX (2026-06 walkthrough): clicking a project ROW navigates to
 *     `/projects/[id]`. Select-to-swap was removed (the painter found it
 *     unintuitive); the inspector is now a LIGHT SECONDARY SUMMARY of the
 *     seed project, not a row-driven detail pane.
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

  test("is a client component owning filter state", () => {
    expect(workspace).toMatch(/^"use client";/);
    expect(workspace).toMatch(/useState\(""\)/); // filter query
  });

  test("desktop ≥1024: two-pane grid (table left + inspector right)", () => {
    expect(workspace).toMatch(/matchMedia\("\(min-width: 1024px\)"\)/);
    expect(workspace).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_380px\]/);
    expect(workspace).toContain("ProjectInspector");
  });

  test("inspector summarises the seed project (no row-driven selection)", () => {
    // Select-to-swap was removed; the inspector is fed the seed project's
    // row, not a row-click-driven selectedId.
    expect(workspace).toMatch(/selected=\{summaryRow\}/);
    expect(workspace).not.toContain("onSelectProject");
    expect(workspace).not.toContain("setSelectedId");
  });

  test("single owner: the table is conditionally mounted, never double-rendered via CSS hidden", () => {
    // The breakpoint branch is `if (isDesktop) return (...)` then a mobile
    // return — a true conditional mount, not two CSS-hidden copies.
    expect(workspace).toMatch(/if \(isDesktop\) \{/);
  });

  test("both layouts render the same selection-free table (rows navigate)", () => {
    // No layout wires selection props anymore; the table owns row
    // navigation itself.
    expect(workspace).not.toMatch(/onSelectProject=/);
    expect(workspace).not.toMatch(/selectedId=/);
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

describe("UX 2026-06 — table rows navigate to the project page", () => {
  const table = read("src/components/ProjectsDashboardTable.tsx");

  test("select-to-swap plumbing is fully removed from the table", () => {
    expect(table).not.toContain("onSelectProject");
    expect(table).not.toMatch(/selectedId/);
    expect(table).not.toMatch(/aria-selected/);
  });

  test("row click navigates to /projects/[id] (guarded against controls)", () => {
    // Both DashboardRow (desktop) and MobileCompRow share the guarded
    // row-click handler that pushes the project route.
    expect(table).toMatch(/router\.push\(`\/projects\/\$\{row\.id\}`\)/);
    expect(table).toContain("isInteractiveTarget");
  });

  test("the row-nav guard ignores interactive descendants", () => {
    // Clicks on links / buttons / inputs / popover menus must NOT trigger
    // navigation, so inline edits + the Name link + Delete keep working.
    expect(table).toMatch(/a, button, input, select, textarea/);
    expect(table).toMatch(/role="menu"/);
  });

  test("project Name stays a real link to /projects/[id]", () => {
    expect(table).toMatch(/href=\{`\/projects\/\$\{row\.id\}`\}/);
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
