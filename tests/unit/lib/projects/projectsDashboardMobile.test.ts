/**
 * UX-901 — Mobile stack-card reflow for the projects dashboard.
 *
 * WCAG 2.2 §1.4.10 (Reflow) requires content to render at 320–414px
 * viewports without horizontal scroll. Before this round the
 * /projects table used `overflow-x-auto` to scroll the dense column
 * set on phones — COMPLETION and DELETE clipped off-screen and the
 * painter had to scrub sideways to find them.
 *
 * Fix: the table now renders as a stacked-card layout under md
 * (≤768px) and stays as a table at md+. Same field set on both,
 * just reflowed: chevron + name + type chip on the header line,
 * recipes strip, status + priority pills inline, full-width
 * completion bar, delete link at the bottom-right.
 *
 * File-level scan locks the contract so the column set can't drift
 * between the two layouts (every field in the table has a card
 * counterpart).
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

describe("ProjectsDashboardTable — mobile stack-card layout (UX-901)", () => {
  const src = read(DASHBOARD);

  test("desktop table is gated to md+ (hidden on phones)", () => {
    // The wrapping <div> around the <table> carries `hidden md:block`
    // so the dense table stops rendering at sub-md viewports.
    expect(src).toMatch(/hidden md:block[\s\S]*?<table/);
  });

  test("mobile card list is gated to sub-md (md:hidden)", () => {
    // The card layout's wrapper carries `md:hidden` so it ONLY
    // renders on phones — never duplicated on desktop.
    expect(src).toMatch(/md:hidden[\s\S]*?DashboardCard/);
  });

  test("a DashboardCard component exists", () => {
    expect(src).toMatch(/function DashboardCard\b/);
  });

  test("DashboardCard renders the same edit affordances the table row has", () => {
    // The popovers for type/status/priority + the AttachRecipeModal +
    // the DeleteProjectButton must all be reachable on mobile — no
    // feature regression between the two layouts. Count the popover
    // call sites inside DashboardCard.
    const start = src.indexOf("function DashboardCard");
    const end = src.indexOf("function PaletteStrip");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const card = src.slice(start, end);
    const popovers = card.match(/<InlineCellPopover\b/g) ?? [];
    // Type, Status, Priority — exactly three popovers in the card.
    expect(popovers.length).toBe(3);
    expect(card).toMatch(/AttachRecipeModal/);
    expect(card).toMatch(/DeleteProjectButton/);
    expect(card).toMatch(/<ProgressBar/);
  });

  test("MobileSortBar surfaces the same sort keys as the table headers", () => {
    expect(src).toMatch(/function MobileSortBar\b/);
    // The select offers every SortKey including updatedAt as
    // "Recently updated" so the painter can re-order their list.
    expect(src).toMatch(/MobileSortBar/);
    const start = src.indexOf("function MobileSortBar");
    const end = src.indexOf("function PaletteStrip");
    expect(start).toBeGreaterThan(-1);
    const bar = src.slice(start, end);
    expect(bar).toContain("name:");
    expect(bar).toContain("type:");
    expect(bar).toContain("status:");
    expect(bar).toContain("priority:");
    expect(bar).toContain("progressPercent:");
    expect(bar).toContain("updatedAt:");
  });

  test("mobile card uses the existing PaletteStrip primitive (no parallel impl)", () => {
    const start = src.indexOf("function DashboardCard");
    const end = src.indexOf("function PaletteStrip");
    const card = src.slice(start, end);
    expect(card).toMatch(/<PaletteStrip\b/);
  });

  test("mobile card list still routes through the same toggleExpanded state", () => {
    // The chevron in the card mirrors the table row's behaviour —
    // tap to expand sub-projects. The session-storage persistence
    // (mm.projects.expanded) is shared.
    const cardStart = src.indexOf("md:hidden");
    const cardEnd = src.indexOf("function MobileSortBar");
    const block = src.slice(cardStart, cardEnd);
    expect(block).toMatch(/toggleExpanded/);
    expect(block).toMatch(/expanded\.has/);
  });
});
