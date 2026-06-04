/**
 * UX (2026-06 walkthrough) — Item 3.
 *
 * Static source-scan net for two coupled refinements on /projects:
 *
 *   1. Clickable-name affordance: a small ↗ glyph sits next to each
 *      project Name (desktop table + mobile comparison row) signalling
 *      the Name/row opens the project page.
 *   2. Tooltip / inline-popover visibility: the InlineCellPopover dropdown
 *      (Type / Status / Priority cell editors) used to render INSIDE the
 *      table row, where the table's `overflow-x-auto` scroll container
 *      clipped it. It is now PORTALLED to <body> and positioned `fixed`
 *      against the trigger, so it is always fully visible.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("Item 3 — clickable-name ↗ affordance", () => {
  const table = read("src/components/ProjectsDashboardTable.tsx");

  test("the Name link carries an ↗ open-project glyph (decorative)", () => {
    // Glyph is decorative (aria-hidden) so screen readers hear the link
    // text, not the arrow. Both the desktop + mobile Name links carry one.
    const arrowCount = (table.match(/↗/g) ?? []).length;
    expect(arrowCount).toBeGreaterThanOrEqual(2);
    // Each ↗ is wrapped in an aria-hidden span.
    expect(table).toMatch(/aria-hidden[\s\S]{0,200}↗/);
  });

  test("the Name link advertises the open action via title", () => {
    expect(table).toMatch(/title=\{`Open \$\{row\.name\}`\}/);
  });

  test("the affordance uses a group-hover brighten (not a cyan-on-rest action)", () => {
    expect(table).toContain("group-hover:text-[var(--color-cyan)]");
  });
});

describe("Item 3 — InlineCellPopover is portalled out of the clipping row", () => {
  const src = read("src/components/ui/InlineCellPopover.tsx");

  test("the dropdown is portalled to document.body", () => {
    expect(src).toContain("createPortal");
    expect(src).toMatch(/createPortal\(menu, document\.body\)/);
  });

  test("the dropdown is positioned `fixed` (viewport-relative), not absolute-in-row", () => {
    expect(src).toContain("fixed z-50");
    // The old in-row positioning is gone.
    expect(src).not.toContain("absolute z-50 left-0 top-full");
  });

  test("it measures the trigger + flips above when there's no room below", () => {
    expect(src).toContain("getBoundingClientRect");
    expect(src).toMatch(/placement.*"above"/);
  });

  test("it re-anchors on scroll (capture) + resize while open", () => {
    expect(src).toMatch(/addEventListener\("scroll", onReflow, true\)/);
    expect(src).toMatch(/addEventListener\("resize", onReflow\)/);
  });

  test("trigger still floors its hit-box (tap-target preserved)", () => {
    expect(src).toContain("tap-target inline-flex items-center");
  });
});
