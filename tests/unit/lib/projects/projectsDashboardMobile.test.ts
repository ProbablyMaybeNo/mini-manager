/**
 * M3 — Restore the mobile comparison table for the projects dashboard.
 *
 * The earlier UX-901 round reflowed the dense table into a stacked-card
 * layout under md to satisfy WCAG 2.2 §1.4.10 (no PAGE horizontal
 * scroll at 320–414px). That fixed reflow but destroyed cross-record
 * comparison — two projects' Status/Completion could no longer be read
 * side by side [BP §7, §14].
 *
 * M3 restores a real table on mobile: a frozen first column (Name) +
 * frozen header row, with the denser Type/Recipes/Status/Priority/
 * Completion columns scrolling horizontally INSIDE a bounded, labelled
 * region (§1.4.10 forbids scrolling the page, not a bounded data
 * region). Row editing of the edge-clip-prone Status/Priority cells
 * moves to a NONMODAL bottom sheet (`RowEditSheet`) so the trigger can
 * never clip at the scrolled right edge the way `InlineCellPopover` did.
 *
 * File-level scan locks the contract: the mobile layout is a table that
 * shares the desktop row's full field set + edit affordances, reuses the
 * existing primitives (PaletteStrip, AttachRecipeModal, ProgressBar,
 * DeleteProjectButton), and keeps drill-down + sort working.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const DASHBOARD = "src/components/ProjectsDashboardTable.tsx";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

/** Slice the source of a top-level `function <name>` up to the next
 *  top-level function declaration, so per-component assertions can't
 *  leak into a neighbour. */
function fnBody(src: string, name: string, nextName: string): string {
  const start = src.indexOf(`function ${name}`);
  const end = src.indexOf(`function ${nextName}`);
  expect(start, `function ${name} should exist`).toBeGreaterThan(-1);
  expect(end, `function ${nextName} should follow ${name}`).toBeGreaterThan(
    start,
  );
  return src.slice(start, end);
}

describe("ProjectsDashboardTable — mobile comparison table (M3)", () => {
  const src = read(DASHBOARD);

  test("desktop table is gated to md+ (hidden on phones)", () => {
    // The wrapping <div> around the dense desktop <table> carries
    // `hidden md:block` so it stops rendering at sub-md viewports.
    expect(src).toMatch(/hidden md:block[\s\S]*?<table/);
  });

  test("mobile layout is a real table, not a card stack (md:hidden region)", () => {
    // The sub-md layout is now a bounded, labelled data region holding
    // an `mm-cmp-table` — the comparison table M3 restored. The old
    // stacked `DashboardCard`/`<ul>` layout must be gone.
    expect(src).toMatch(/md:hidden[\s\S]*?role="region"[\s\S]*?mm-cmp-table/);
    expect(src).not.toMatch(/function DashboardCard\b/);
  });

  test("the comparison region is a bounded, labelled scroll container", () => {
    // §1.4.10-safe: scrolling happens inside this region (overflow-x-auto
    // + tabIndex for keyboard scroll), not on the page. It is labelled
    // for screen readers.
    expect(src).toMatch(/role="region"/);
    expect(src).toMatch(/aria-label="Projects comparison table"/);
  });

  test("a MobileCompRow component renders one <tr> per project", () => {
    expect(src).toMatch(/function MobileCompRow\b/);
  });

  test("the Name column is frozen (mm-cmp-freeze) for cross-record comparison", () => {
    // Frozen first column keeps the human-readable identifier in view
    // while the denser columns scroll [BP §7 task 1]. Applied to both
    // the header cell and the body cell.
    expect(src).toMatch(/mm-cmp-freeze/);
    const row = fnBody(src, "MobileCompRow", "RowEditSheet");
    expect(row).toMatch(/mm-cmp-freeze/);
  });

  test("MobileCompRow keeps every edit affordance the desktop row has", () => {
    // No feature regression vs the desktop table row: Type stays an
    // inline popover (early column, no clip risk); Status + Priority move
    // to the nonmodal RowEditSheet; recipes + delete + progress intact.
    const row = fnBody(src, "MobileCompRow", "RowEditSheet");
    expect(row).toMatch(/<InlineCellPopover\b/); // Type
    expect(row).toMatch(/<RowEditSheet\b/); // Status + Priority
    expect(row).toMatch(/setSheetField\("status"\)/);
    expect(row).toMatch(/setSheetField\("priority"\)/);
    expect(row).toMatch(/AttachRecipeModal/);
    expect(row).toMatch(/DeleteProjectButton/);
    // UX-006 — completion is now the SegmentedBar viz (was ProgressBar).
    expect(row).toMatch(/<SegmentedBar/);
  });

  test("row editing opens a NONMODAL bottom sheet with X + Back dismiss", () => {
    // RowEditSheet replaces the edge-clipping InlineCellPopover for
    // Status/Priority. Nonmodal (no backdrop, table stays readable),
    // dismissible by Escape, click-outside, and Back (popstate)
    // [MOBILE §M3 step 4, BP §6, §7 task 3].
    expect(src).toMatch(/function RowEditSheet\b/);
    const sheet = fnBody(src, "RowEditSheet", "RowEditOption");
    expect(sheet).toMatch(/role="dialog"/);
    expect(sheet).toMatch(/aria-modal="false"/);
    expect(sheet).toMatch(/aria-label="Close row editor"/);
    expect(sheet).toMatch(/popstate/);
    expect(sheet).toMatch(/createPortal/);
  });

  test("MobileSortBar surfaces the same sort keys as the table headers", () => {
    expect(src).toMatch(/function MobileSortBar\b/);
    const bar = fnBody(src, "MobileSortBar", "Th");
    expect(bar).toContain("name:");
    expect(bar).toContain("type:");
    expect(bar).toContain("status:");
    expect(bar).toContain("priority:");
    expect(bar).toContain("progressPercent:");
    expect(bar).toContain("updatedAt:");
  });

  test("mobile row uses the existing PaletteStrip primitive (no parallel impl)", () => {
    const row = fnBody(src, "MobileCompRow", "RowEditSheet");
    expect(row).toMatch(/<PaletteStrip\b/);
  });

  test("mobile table still routes through the shared toggleExpanded state", () => {
    // The chevron in the frozen column mirrors the desktop row's
    // drill-down; sessionStorage expansion (mm.projects.expanded) is
    // shared via the parent's toggleExpanded.
    const start = src.indexOf("md:hidden");
    const end = src.indexOf("function MobileSortBar");
    const block = src.slice(start, end);
    expect(block).toMatch(/toggleExpanded/);
    expect(block).toMatch(/expanded\.has/);
  });
});
