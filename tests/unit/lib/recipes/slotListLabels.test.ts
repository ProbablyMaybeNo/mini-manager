/**
 * 2026-06-04 unify + flatten — recipe editor flat-slot UI vocabulary.
 *
 * A recipe is now one ordered list of slots; each slot = one paint + its
 * layer. There are no zones, no Steps box, and no SLOTS/NOTES segmented
 * control. These tests pin the visible vocabulary + the flat-slot wiring
 * so a future change can't drag the two-level model back into the UI.
 *
 * We read the source files as text (not import them) because the
 * components are `'use client'` modules with transitive server-action
 * imports that crash a Node-only test environment.
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

describe("SlotList — flat slot UI strings", () => {
  const src = read("src/components/recipes/SlotList.tsx");

  test("Card title uses 'Recipe slots ·'", () => {
    expect(src).toContain("Recipe slots · ");
    expect(src).not.toContain("Color slots · ");
    expect(src).not.toContain("title={`Zones · ");
  });

  test("the AddSlotTile carries the 'Add paint' label", () => {
    expect(src).toContain("Add paint");
    expect(src).not.toContain(">Add zone</");
    expect(src).not.toContain(">Add zone<");
  });

  test("empty-state copy references 'slots' not 'zones'", () => {
    expect(src).toContain("No slots yet");
    expect(src).not.toContain("No zones yet");
  });

  test("delete confirm prompt + aria-label use 'slot'", () => {
    expect(src).toContain("Delete this slot");
    expect(src).toContain("Delete slot");
  });

  test("mutates exclusively via the flat recipeSlots actions", () => {
    expect(src).toContain("addSlot,");
    expect(src).toContain("deleteSlot,");
    expect(src).toContain("reorderSlots,");
    expect(src).toContain("updateSlot,");
    // No zone/step actions linger in the editor.
    expect(src).not.toContain("recipeZones");
    expect(src).not.toContain("recipeSteps");
  });

  test("paints-only — the add path takes a paint id", () => {
    expect(src).toContain("handleAddPaint");
    expect(src).toContain("addSlot({ recipeId, paintId })");
  });
});

describe("RecipeEditorClient — no zones, no Steps box, no segmented control", () => {
  const src = read("src/components/recipes/RecipeEditorClient.tsx");

  test("renders the flat SlotList, not ZoneList/StepList", () => {
    expect(src).toContain("SlotList");
    expect(src).not.toContain("ZoneList");
    expect(src).not.toContain("StepList");
  });

  test("the SLOTS/NOTES segmented control is gone", () => {
    expect(src).not.toContain("SegmentedControl");
    expect(src).not.toContain("MobilePaneTabs");
  });

  test("there is exactly one notes surface (single RecipeNotes mount)", () => {
    const matches = src.match(/<RecipeNotes/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

describe("Recipe surfaces — flat-slot vocabulary sweep", () => {
  test("AttachedRecipeSummary empty state mentions 'slots'", () => {
    const src = read("src/components/recipes/AttachedRecipeSummary.tsx");
    expect(src).toContain("No slots yet");
    expect(src).not.toContain("No zones yet");
  });

  test("RecipeCard empty hint mentions 'colour slots'", () => {
    const src = read("src/components/recipes/RecipeCard.tsx");
    expect(src).toContain("empty — no colour slots yet");
  });

  test("RecipeCard plural counter renders 'slot/slots'", () => {
    const src = read("src/components/recipes/RecipeCard.tsx");
    expect(src).toContain("slot{slotCount === 1 ? \"\" : \"s\"}");
  });

  test("PublicRecipeView empty state mentions 'slots'", () => {
    const src = read("src/components/recipes/PublicRecipeView.tsx");
    expect(src).toContain("This recipe has no slots yet");
  });

  test("PublicRecipeView count renders 'slot/slots'", () => {
    const src = read("src/components/recipes/PublicRecipeView.tsx");
    expect(src).toContain("slot");
    expect(src).not.toContain(".zones");
  });
});

describe("B2 — only catalog paints are addable to a slot", () => {
  const src = read("src/components/recipes/PaintSlotPicker.tsx");

  test("the custom-hex mode toggle is gone", () => {
    expect(src).not.toContain('setMode("hex")');
    expect(src).not.toContain('"library" | "hex"');
  });

  test("paints are pickable + the picker writes via updateSlot or onPick", () => {
    expect(src).toContain("handlePickPaint");
    expect(src).toContain("paintId: paint.id");
    expect(src).toContain("updateSlot");
  });
});

describe("B3 — brand filter chips in the paint picker", () => {
  const src = read("src/components/recipes/PaintSlotPicker.tsx");

  test("reuses the FilterChip primitive", () => {
    expect(src).toContain('from "@/components/ui/FilterChip"');
    expect(src).toContain("<FilterChip");
  });

  test("renders an All chip plus one chip per brand", () => {
    expect(src).toContain("brands.map");
    expect(src).toContain('active={brand === ""}');
    expect(src).toContain("active={brand === b}");
  });
});

describe("B5 — single 'Recipe notes' box", () => {
  test("RecipeNotes card title reads 'Recipe notes'", () => {
    const src = read("src/components/recipes/RecipeNotes.tsx");
    expect(src).toContain('title="Recipe notes"');
    expect(src).not.toContain('title="Notes"');
  });
});
