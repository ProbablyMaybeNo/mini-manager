/**
 * P12.9 — Project detail "Color Scheme" box.
 *
 * Ross's locked behaviour: 3 starter `+` boxes. Clicking either
 * creates a recipe (when none attached) or adds a slot to the
 * attached recipe. Clicking a filled box opens the picker to swap.
 * Recipe name shown above the boxes when one is attached.
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

describe("ProjectColorSchemeBox component surface", () => {
  const src = read("src/components/ProjectColorSchemeBox.tsx");

  test("Card title shows the recipe name when one is attached", () => {
    expect(src).toContain("`Recipe · ${attachedRecipeName}`");
    expect(src).not.toContain("Color scheme ·");
  });

  test("3 ghost boxes render when no recipe is attached", () => {
    expect(src).toContain('Array.from({ length: 3 }');
  });

  test("the + Add paint CTA uses success-green (Phase-12 discipline)", () => {
    expect(src).toMatch(/variant="success"[\s\S]{0,200}\+ Add paint/);
  });

  test("clicking a + box without a recipe opens the unified AttachRecipeModal (UX-904)", () => {
    // Pre-UX-904 the + ghost called handleCreateRecipeAndOpenPicker
    // which silently created an auto-named "<project> scheme" recipe
    // with no chance to pick an existing one. Now it opens the same
    // modal the /projects table uses: Pick existing OR Create new.
    expect(src).toContain("AttachRecipeModal");
    expect(src).toMatch(/setAttachOpen\(true\)/);
    expect(src).not.toContain("handleCreateRecipeAndOpenPicker");
  });

  test("clicking a + box with a recipe attached calls addSlot", () => {
    expect(src).toContain("addSlot({");
    expect(src).not.toContain("addSlotWithPaint");
  });

  test("clicking a filled box opens the picker in edit mode", () => {
    expect(src).toContain('{ kind: "edit"; slotIndex: number }');
    expect(src).toContain("updateSlot");
  });

  test("delete (x) on a filled box calls deleteSlot", () => {
    expect(src).toContain("deleteSlot");
    expect(src).toContain("handleDeleteSlot");
  });

  test("the ColorPicker primitive is wired into the side panel", () => {
    expect(src).toContain("<ColorPicker");
    expect(src).toContain("onSelect={onSelect}");
  });

  test("the picker side panel is dialog-modal + Esc-closable via backdrop click", () => {
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain("onClick={onClose}");
  });

  test("PHASE-2 — the recipe Card carries corner ticks + a coordinate label", () => {
    // Cohesion with the dashboard KPI cards + the roster/stages panels.
    expect(src).toContain("ticks");
    expect(src).toContain('techLabel="OPS ▸ RECIPE"');
  });
});

describe("Project inspector wires the recipe section in (FIGMA-REBUILD §9)", () => {
  // FIGMA-REBUILD §9 — the /projects/[id] detail PAGE became the slide-out
  // ProjectInspector. The full COLOR SCHEME editor box (3-ghost-box recipe
  // builder) was NOT carried into the compact inspector; the inspector
  // shows the attached-recipe palette chips + an ASSIGN dropdown instead.
  // Its data is loaded server-side by projectInspectorActions.ts (mined
  // from the retired detail page).
  const action = read("src/components/projects/projectInspectorActions.ts");
  const panel = read("src/components/projects/ProjectInspector.tsx");

  test("the inspector data action fetches the attached recipes + resolves palette strips", () => {
    expect(action).toContain("listRecipesForProject");
    expect(action).toContain("paletteStripsForRecipes");
  });

  test("the VM carries recipe chips (hexes) + assign candidates", () => {
    expect(action).toContain("recipes:");
    expect(action).toContain("hexes:");
    expect(action).toContain("attachCandidates:");
  });

  test("the inspector renders the recipe chips + an ASSIGN dropdown", () => {
    expect(panel).toContain("vm.recipes");
    expect(panel).toContain("vm.attachCandidates");
    expect(panel).toContain("attachRecipeToProject");
  });
});
