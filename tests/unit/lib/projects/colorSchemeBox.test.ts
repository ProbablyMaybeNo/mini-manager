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
    expect(src).toContain(
      "`Color scheme · ${attachedRecipeName}`",
    );
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

  test("clicking a + box with a recipe attached calls addSlotWithPaint", () => {
    expect(src).toContain("addSlotWithPaint");
  });

  test("clicking a filled box opens the picker in edit mode", () => {
    expect(src).toContain('{ kind: "edit"; slotIndex: number }');
    expect(src).toContain("updateStep");
  });

  test("delete (x) on a filled box calls deleteZone", () => {
    expect(src).toContain("deleteZone");
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
});

describe("Project detail page wires the Color Scheme box in", () => {
  const src = read("src/app/projects/[id]/page.tsx");

  test("imports ProjectColorSchemeBox + ColorSchemeSlot type", () => {
    expect(src).toContain("ProjectColorSchemeBox");
    expect(src).toContain("ColorSchemeSlot");
  });

  test("fetches the attached recipe + resolves slot palette server-side", () => {
    expect(src).toContain("listRecipesForProject");
    expect(src).toContain("colorSchemeSlots");
  });

  test("passes attachedRecipeId + slots through to the box", () => {
    expect(src).toContain("attachedRecipeId={attachedRecipe?.id");
    expect(src).toContain("slots={colorSchemeSlots}");
  });
});
