/**
 * Ross 2026-06-02 screenshot fixes on the mobile /projects view:
 *   1. FOCUS recipe was buried under the stopwatch → FocusPanel must
 *      render BEFORE the Stopwatch in the FOCUS section.
 *   2. Import / New buttons must be symmetric with the quick-add box →
 *      full-width row + flex-1 buttons on mobile.
 *   3. The FOCUS picker option text ran past its box → the select must
 *      be width-contained + truncating on mobile.
 *
 * Source-level sentinels (the established pattern here — these are
 * server/client wiring concerns that the node test env can't render).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
const read = (rel: string) => fs.readFileSync(path.resolve(ROOT, rel), "utf-8");

describe("/projects mobile screenshot fixes (2026-06-02)", () => {
  const page = read("src/app/projects/page.tsx");
  // FOCUS-FOLD (2026-06-08) — the FOCUS bench folded back into the
  // dashboard as DashboardFocusSection; its panel/stopwatch order is
  // pinned in that section component now.
  const focusSection = read("src/components/focus/DashboardFocusSection.tsx");
  const picker = read("src/components/focus/FocusPicker.tsx");

  test("FOCUS recipe (FocusPanel) renders before the Stopwatch", () => {
    const panelIdx = focusSection.indexOf("<FocusPanel");
    const stopwatchIdx = focusSection.indexOf("<Stopwatch");
    expect(panelIdx).toBeGreaterThan(-1);
    expect(stopwatchIdx).toBeGreaterThan(-1);
    expect(panelIdx).toBeLessThan(stopwatchIdx);
  });

  test("Add project / Upload army list CTAs sit under the table (FIGMA-REBUILD §3)", () => {
    // FIGMA-REBUILD §3 — the Dashboard.png reference puts ADD PROJECT
    // (primary) + UPLOAD ARMY LIST (tertiary outline) UNDER the PROJECTS
    // table, not in the page header. They live in DashboardProjectsTable now
    // and wrap on a flex row (no per-button flex-1 fill).
    const table = read("src/components/projects/DashboardProjectsTable.tsx");
    expect(table).toContain('href="/projects/new"');
    expect(table).toContain('href="/projects/import"');
    expect(table).toContain("flex flex-wrap gap-2");
  });

  test("FOCUS picker select is width-contained + truncating on mobile", () => {
    expect(picker).toContain("w-full");
    expect(picker).toContain("truncate");
    expect(picker).toContain("min-w-0");
  });
});
