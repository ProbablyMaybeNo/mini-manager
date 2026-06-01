/**
 * P11.14 — Phase 11 regression sweep.
 *
 * Cross-cutting net that locks the cumulative result of every prior
 * P11.* milestone in one place. Anything that quietly slides backwards
 * (palette token gone, vocabulary regressed, decorative chrome
 * re-introduced) trips this file before it ships.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../", rel),
    "utf-8",
  );
}

describe("Phase 11 — palette tokens still in place (P11.10)", () => {
  const css = read("src/app/globals.css");

  test("--color-purple-pastel: #b794f6 token survives", () => {
    expect(css).toMatch(/--color-purple-pastel:\s*#b794f6/i);
  });

  test("--status-purple semantic alias survives", () => {
    expect(css).toMatch(/--status-purple/);
  });

  test("pill-purple class survives", () => {
    expect(css).toMatch(/\.pill-purple/);
  });

  test(".type-chip palette modifiers survive (cyan / amber / green / purple / yellow)", () => {
    expect(css).toMatch(/\.type-chip-cyan/);
    expect(css).toMatch(/\.type-chip-amber/);
    expect(css).toMatch(/\.type-chip-green/);
    expect(css).toMatch(/\.type-chip-purple/);
    expect(css).toMatch(/\.type-chip-yellow/);
  });

  test("btn-wishlist-cta modifier survives", () => {
    expect(css).toMatch(/\.btn-wishlist-cta/);
  });
});

describe("Phase 11 — concrete vocabulary survives (P11.1 / P11.3 / P11.4)", () => {
  test("StageCounter labels render as full caps with DONE not COMPLETE", () => {
    const src = read("src/components/stageCounterLabels.ts");
    expect(src).toMatch(/complete:\s*"DONE"/);
  });

  test("Recipe slot vocabulary survives — no `>Add zone<` strings", () => {
    // P12.2 replaced the free-text "+ Add color" Button with an
    // AddSlotTile (still labelled "Add color") that opens the
    // ColorPicker side panel. The locked vocabulary survives.
    const src = read("src/components/recipes/ZoneList.tsx");
    expect(src).not.toContain(">Add zone<");
    expect(src).toContain("Add color");
  });

  test("Wishlist panel uses 'Wishlist' title, no 'Shopping for this'", () => {
    const src = read("src/components/wishlist/ShoppingForThisPanel.tsx");
    expect(src).not.toContain("Shopping for this · ");
    expect(src).toContain("Wishlist · ");
  });
});

describe("Phase 11 — primitives wired (P11.5 / P11.7 / P11.8 / P11.9)", () => {
  test("StageBarsStrip primitive still exists (project detail may consume it)", () => {
    // P11-followup: Ross removed the per-row stage squares from ProjectRow
    // on /projects — they read as visual noise on 0% rows. The primitive
    // stays in the codebase in case the project detail wants the visual
    // breakdown later.
    expect(() => read("src/components/ui/StageBarsStrip.tsx")).not.toThrow();
    const projectRow = read("src/components/ProjectRow.tsx");
    expect(projectRow).not.toContain("StageBarsStrip");
  });

  test("RecipeCard maps bodyType → type-chip palette", () => {
    const src = read("src/components/recipes/RecipeCard.tsx");
    expect(src).toContain("BODY_TYPE_CHIP");
  });

  test("Tools index assigns one palette slot per tool", () => {
    const src = read("src/app/tools/page.tsx");
    expect(src).toMatch(/tone:\s*"purple"/);
    expect(src).toMatch(/tone:\s*"cyan"/);
    expect(src).toMatch(/tone:\s*"green"/);
    expect(src).toMatch(/tone:\s*"yellow"/);
  });

  test("User page renders the Plan section with PlanTier type", () => {
    // P12.17 split PRO into PRO_MONTHLY + PRO_LIFETIME so the locked
    // pricing rows (monthly $4 vs lifetime $29) can render distinct
    // cards.
    const src = read("src/app/user/page.tsx");
    expect(src).toContain(
      'type PlanTier = "FREE" | "PRO_MONTHLY" | "PRO_LIFETIME" | "FOUNDER"',
    );
  });
});

describe("Phase 11 — decorative brackets stay retired (P11.11)", () => {
  const surfaces = [
    "src/components/library/InventoryControls.tsx",
    "src/components/recipes/CloneButton.tsx",
    "src/components/recipes/QrCode.tsx",
    "src/components/user/ExportButton.tsx",
    "src/components/wishlist/MarkBoughtModal.tsx",
    "src/components/wishlist/QuickAddBar.tsx",
    "src/components/wishlist/WishlistDetailDrawer.tsx",
    "src/components/NamedModelRow.tsx",
    "src/components/NewProjectForm.tsx",
    "src/components/recipes/PaintSlotPicker.tsx",
    "src/components/tools/eyedropper/DropZone.tsx",
  ];

  for (const file of surfaces) {
    test(`${file} carries no decorative `+`[ ! ]`+` chrome`, () => {
      const src = read(file);
      expect(src).not.toMatch(/\[\s*!\s*\]/);
    });
  }
});

describe("Phase 11 — microcopy persisted (P11.12)", () => {
  test("StageCounter cascade explainer persists", () => {
    expect(read("src/components/StageCounter.tsx")).toMatch(
      /Each stage flows into the next/,
    );
  });

  test("ZoneList colour-slot inline help persists (P12.2 / R7-002 microcopy)", () => {
    // P12.2 replaced the "Each colour slot is one part of the model"
    // copy from P11.12 with a click-to-pick affordance pointer. The
    // recipe is now about COLOUR + PAINTS, not model parts. R7-002
    // sharpened the verbs (ADD vs REPLACE) to fix the auditor's
    // "edit-slot ambiguity" finding.
    const src = read("src/components/recipes/ZoneList.tsx");
    expect(src).toContain("Click any");
    expect(src).toContain("slot to ADD a new colour");
  });

  test("Tools H1 subheadings stay painter-vocab", () => {
    const match = read("src/components/tools/match/MatchClient.tsx");
    expect(match).toMatch(/identical to the eye/);
    const gradient = read("src/components/tools/gradient/GradientClient.tsx");
    expect(gradient).toMatch(/transitions feel even across the eye/);
  });
});
