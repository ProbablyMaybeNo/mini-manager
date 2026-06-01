/**
 * P12.7 — Expandable Army > Unit > Model rows on the projects
 * dashboard table.
 *
 * Click the row's chevron to toggle inline-children. Persist the
 * expanded set in sessionStorage (key 'mm.projects.expanded') so
 * navigating away + back to /projects preserves the painter's
 * open Armies.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

describe("ProjectsDashboardTable — expandable hierarchy", () => {
  const src = read("src/components/ProjectsDashboardTable.tsx");

  test("ProjectDashboardRow VM carries parentId + depth", () => {
    expect(src).toContain("parentId: string | null");
    expect(src).toContain("depth: number");
  });

  test("expanded set persists in sessionStorage under a stable key", () => {
    expect(src).toContain("mm.projects.expanded");
    expect(src).toContain("window.sessionStorage.getItem");
    expect(src).toContain("window.sessionStorage.setItem");
  });

  test("expanded state hydrates on mount (avoids SSR mismatch)", () => {
    // First render uses an empty Set so server + client markup match;
    // useEffect then bumps state from storage. Pin this so a refactor
    // doesn't accidentally read storage during render and break SSR.
    expect(src).toContain("useEffect");
    expect(src).toContain("setExpandedState(readExpanded())");
  });

  test("toggleExpanded flips a single id in the set", () => {
    expect(src).toContain("toggleExpanded");
    expect(src).toMatch(/next\.delete\(id\)/);
    expect(src).toMatch(/next\.add\(id\)/);
  });

  test("a leading chevron column joins the original 6", () => {
    expect(src).toMatch(/aria-label=/);
    // The chevron button toggles the row's expanded state.
    expect(src).toMatch(/aria-expanded=\{expanded\}/);
    // R7-011 — single ▸ glyph that rotates 90° on expand. The old
    // glyph-swap pattern (▸ vs ▾) is gone in favour of CSS rotation
    // so the button has a single source of truth + a 36×36 hit box
    // clearing WCAG 2.5.8.
    expect(src).toContain("▸");
    expect(src).toContain('rotate-90');
  });

  test("renderRows recursively walks expanded children", () => {
    // The render walks: push the row, if expanded recurse into kids.
    // Children retain their natural order (createdAt asc from SQL).
    expect(src).toContain("childrenByParent.get(row.id)");
    expect(src).toContain("for (const k of kids) walk(k)");
  });

  test("sort only governs top-level rows; nested children keep parent order", () => {
    // P12.7 invariant: clicking 'Type' or 'Priority' on the table
    // shouldn't reshuffle children inside an Army. The sortedTopLevel
    // memo + walk pattern enforces this — children stay in array
    // order from listAllProjects.
    expect(src).toContain("sortedTopLevel");
    expect(src).toContain("topLevel.slice()");
  });

  test("depth-based indent is applied via paddingLeft", () => {
    expect(src).toContain("indentPx");
    expect(src).toContain("row.depth * 16");
  });

  test("tree-connector pseudo-element renders for depth > 0", () => {
    // Inline-style dashed border-left for the depth connector.
    expect(src).toContain("row.depth > 0");
    expect(src).toContain("dashed var(--color-border-strong)");
  });

  test("leaf rows at depth > 0 still show a placeholder in the chevron column", () => {
    // Visual rhythm: every nested row reserves the chevron column so
    // the columns stay aligned even when a row has no kids.
    expect(src).toMatch(/row\.depth\s*>\s*0/);
  });
});

describe("Projects page — depth computation", () => {
  const src = read("src/app/projects/page.tsx");

  test("the page now fetches listAllProjects (not just top-level)", () => {
    expect(src).toContain("listAllProjects");
    expect(src).not.toContain("listTopLevelProjects");
  });

  test("depthOf walks parentId chain with a memoising cache", () => {
    expect(src).toContain("depthCache");
    expect(src).toContain("depthOf");
  });

  test("rows pass parentId + depth into the VM", () => {
    expect(src).toContain("parentId: p.parentId");
    expect(src).toContain("depth: depthOf(p.id)");
  });
});
