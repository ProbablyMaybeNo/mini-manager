/**
 * FIGMA-REBUILD §7 — Focus is a full page at `/focus`, not a dashboard bench.
 *
 * Supersedes FOCUS-FOLD (2026-06-08). Ross's locked decision (2026-06-09):
 * launch Focus from project rows / inspector; remove DashboardFocusSection.
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

describe("FIGMA rebuild — /focus full page exists", () => {
  test("app/focus/page.tsx mounts FocusPageSection", () => {
    const page = read("src/app/focus/page.tsx");
    expect(page).toContain("FocusPageSection");
    expect(page).toContain('accent="cyan"');
  });

  test("FocusPageSection mounts bench primitives", () => {
    const section = read("src/components/focus/FocusPageSection.tsx");
    expect(section).toContain("FocusPicker");
    expect(section).toContain("FocusPanel");
    expect(section).toContain("Stopwatch");
    expect(section).toContain("PlannerInspoCell");
  });

  test("supports ?project= launch context", () => {
    const section = read("src/components/focus/FocusPageSection.tsx");
    expect(section).toContain("getRecipeBundleForProject");
  });
});

describe("FIGMA rebuild — dashboard no longer embeds the focus bench", () => {
  const page = read("src/app/projects/page.tsx");

  test("does not mount DashboardFocusSection", () => {
    expect(page).not.toMatch(/<DashboardFocusSection/);
  });
});

describe("Legacy /planner route stays removed", () => {
  test("no app/planner/page.tsx", () => {
    expect(exists("src/app/planner/page.tsx")).toBe(false);
  });

  test("next.config redirects /planner → /projects", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toMatch(/source:\s*"\/planner"/);
    expect(cfg).toMatch(/destination:\s*"\/projects"/);
  });
});
