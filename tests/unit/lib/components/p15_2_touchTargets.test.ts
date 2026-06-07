/**
 * P15.2 — Touch-target sweep app-wide.
 *
 * Source-level visual-regression pins for the interactive elements that
 * the sweep brought up to the WCAG 2.5.8 (≥24×24px) hard floor and, where
 * practical, the Apple-HIG (≥44×44px) touch target. The shared mechanism
 * is the `tap-target` utility class (44px mobile / 32px desktop, defined
 * in globals.css) so sizing stays centralised rather than scattered as
 * ad-hoc per-component min-heights.
 *
 * These pins lock the hit-area treatment so a future refactor can't
 * silently shrink a target back under the floor. They assert on source
 * text (the established convention in this repo for sizing regressions —
 * see disclosureCaret.test.ts / mobileHeader.test.ts).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("P15.2 — tap-target utility is the shared floor mechanism", () => {
  const css = read("src/app/globals.css");

  test("globals.css defines .tap-target at 44px (mobile default)", () => {
    expect(css).toContain(".tap-target {");
    expect(css).toMatch(/\.tap-target\s*\{[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px/);
  });

  test("globals.css narrows .tap-target to 32px on desktop (min-width:768px)", () => {
    expect(css).toMatch(
      /@media\s*\(min-width:\s*768px\)\s*\{[\s\S]*?\.tap-target\s*\{[\s\S]*?min-width:\s*32px[\s\S]*?min-height:\s*32px/,
    );
  });
});

describe("UX-011 — dashboard row links + filter clear the 24px floor", () => {
  const table = read("src/components/ProjectsDashboardTable.tsx");
  const filter = read("src/components/projects/DashboardProjectsTable.tsx");

  test("desktop + mobile project-name links carry tap-target", () => {
    // Both row variants floor the name link's own hit area (was ~17px text
    // line-height) via tap-target.
    const occurrences = table.split("tap-target group").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  test("the dashboard filter input clears the touch floor", () => {
    expect(filter).toContain("min-h-[44px]");
    expect(filter).toContain("md:min-h-[36px]");
  });
});

describe("P15.2 — shared InlineCellPopover trigger floors its hit-box", () => {
  const src = read("src/components/ui/InlineCellPopover.tsx");

  test("the popover trigger button carries tap-target", () => {
    // The trigger wraps a ~20px pill/strip; without a floor the bare
    // button was a sub-24px target on every inline cell that uses it.
    const idx = src.indexOf("onClick={() => setOpen((v) => !v)}");
    expect(idx).toBeGreaterThan(0);
    const around = src.slice(idx, idx + 520);
    expect(around).toContain("tap-target");
    expect(around).toContain("inline-flex items-center");
  });

  test("InlineCellPopoverItem menu rows clear the 24px floor", () => {
    expect(src).toContain("py-1.5 min-h-[28px]");
  });
});

describe("P15.2 — sort header triggers floor their hit-box", () => {
  test("ProjectsDashboardTable sort buttons use tap-target inline-flex", () => {
    const src = read("src/components/ProjectsDashboardTable.tsx");
    expect(src).toContain("tap-target inline-flex items-center uppercase");
  });

  test("RecipesTable sort buttons use tap-target inline-flex", () => {
    const src = read("src/components/recipes/RecipesTable.tsx");
    expect(src).toContain("tap-target inline-flex items-center uppercase");
  });
});

describe("P15.2 — inline recipe-cell trigger floors its hit-box", () => {
  const src = read("src/components/ProjectsDashboardTable.tsx");

  test("the recipe-cell trigger button carries tap-target", () => {
    const idx = src.indexOf("onClick={handleRecipeCellClick}");
    expect(idx).toBeGreaterThan(0);
    const around = src.slice(idx, idx + 420);
    expect(around).toContain("tap-target inline-flex items-center");
  });
});

describe("P15.2 — FOCUS companion touch surfaces", () => {
  test("StepCompletionCheckbox label expands the hit-box around the 20px box", () => {
    const src = read("src/components/focus/StepCompletionCheckbox.tsx");
    // Visual checkbox stays 20px (w-5 h-5); the label is the larger target.
    expect(src).toContain("w-5 h-5");
    expect(src).toContain("tap-target inline-flex items-center justify-center");
  });

  test("RecipeTabs segmented tabs carry tap-target", () => {
    const src = read("src/components/focus/RecipeTabs.tsx");
    expect(src).toContain('className="tap-target"');
  });
});

describe("P15.2 — segmented controls clear the touch floor", () => {
  test("ViewModeToggle sub-buttons use tap-target (no bespoke min-height)", () => {
    const src = read("src/components/library/ViewModeToggle.tsx");
    expect(src).toContain("tap-target inline-flex items-center justify-center");
    expect(src).not.toContain("min-h-[28px]");
  });

  test("ImportClient actions route through the Button primitive (no bespoke tab buttons)", () => {
    const src = read("src/components/imports/ImportClient.tsx");
    // The segmented mode tabs were removed in favour of always-visible
    // drop-file + paste sections; the remaining actions (Choose file /
    // Parse list) use the <Button> primitive whose .btn-sm floors to a
    // 44px tap-target on mobile via globals.css.
    expect(src).not.toContain('role="tab"');
    expect(src).toContain('{isPending ? "Parsing…" : "Choose file"}');
    expect(src).toContain('{isPending ? "Parsing…" : "Parse list"}');
  });
});

describe("P15.2 — Match results swatch is a 44px hit-box over a 20px chip", () => {
  const src = read("src/components/tools/match/MatchResultsRow.tsx");

  test("the row's first grid track widened to 44px to host the hit-box", () => {
    expect(src).toContain("grid-cols-[44px_1fr_72px_auto]");
  });

  test("the clickable swatch button is a tap-target wrapping a 20px chip", () => {
    expect(src).toContain("tap-target inline-flex items-center justify-center");
    // The visual chip is still 20px; the hover/focus ring moved onto it.
    expect(src).toContain("w-5 h-5 rounded-sm border group-focus:ring-2");
  });

  test("the reseed onClick wiring is preserved", () => {
    expect(src).toContain("onClick={() => onPickColor(paint.hex)}");
  });
});

describe("P15.2 — recipe PaintSlotPicker + PaintDetailPanel inline triggers", () => {
  test("PaintSlotPicker paint rows carry tap-target", () => {
    const src = read("src/components/recipes/PaintSlotPicker.tsx");
    expect(src).toContain("text-left tap-target");
  });

  test("PaintDetailPanel copy-hex + harmony swatches carry tap-target", () => {
    const src = read("src/components/library/PaintDetailPanel.tsx");
    expect(src).toContain("tap-target inline-flex items-center text-xs font-mono px-2 py-1 frame");
    expect(src).toContain("tap-target h-8 flex-1 min-w-[32px]");
  });
});
