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

  test("the add path persists a ColorPicker selection (paint id OR raw hex)", () => {
    // v6-4 bug fix — the side panel now hosts the full ColorPicker, so a
    // selection is either a library paint (paintId) or a raw hex from the
    // wheel / harmony / eyedropper (customColorHex). Both flow through
    // addSlot via the shared selectionPatch helper.
    expect(src).toContain("handleAddPaint");
    // The add path derives the patch from the selection then sends it to
    // addSlot (the optimistic-add fix names the intermediate `patch` so
    // the same shape feeds both the optimistic cell and the write).
    expect(src).toContain("const patch = selectionPatch(selection)");
    expect(src).toContain("await addSlot({ recipeId, ...patch })");
    expect(src).toContain("paintId: selection.paintId");
    expect(src).toContain("customColorHex: selection.hex");
  });
});

describe("SlotList — optimistic add (perf-lag fix)", () => {
  const src = read("src/components/recipes/SlotList.tsx");

  test("appends an optimistic cell before awaiting the server write", () => {
    // The optimistic append must happen synchronously in handleAddPaint,
    // BEFORE the addSlot await inside the transition — that's what makes
    // the swatch show instantly.
    const handler = src.slice(
      src.indexOf("const handleAddPaint"),
      src.indexOf("const handleSwapPaint"),
    );
    const appendIdx = handler.indexOf("setLocalSlots((prev) => [...prev, optimisticSlot])");
    const awaitIdx = handler.indexOf("await addSlot(");
    expect(appendIdx).toBeGreaterThan(-1);
    expect(awaitIdx).toBeGreaterThan(-1);
    expect(appendIdx).toBeLessThan(awaitIdx);
  });

  test("uses the picked hex for the optimistic swatch", () => {
    expect(src).toContain("swatchHex: selection.hex");
  });

  test("rolls the optimistic cell back when the write fails", () => {
    expect(src).toContain("setLocalSlots((prev) => prev.filter((s) => s.id !== tempId))");
  });

  test("optimistic temp ids are namespaced + recognised", () => {
    expect(src).toContain('`optimistic-${optimisticSeq.current}`');
    expect(src).toContain('return id.startsWith("optimistic-")');
  });

  test("optimistic cells are guarded out of delete / reorder / edit", () => {
    // delete drops locally instead of calling the server action.
    expect(src).toContain("if (isOptimisticId(slotId)) {");
    // reorder skips when either end is an optimistic cell.
    expect(src).toContain("if (isOptimisticId(draggedId) || isOptimisticId(targetId)) return;");
    // selecting an optimistic cell does not open the editor panel.
    expect(src).toContain("if (isOptimisticId(slot.id)) return;");
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

describe("Item 2 — WISHLIST + OWNED buttons in the slot side panel", () => {
  const buttons = read("src/components/recipes/RecipeInventoryButtons.tsx");
  const slotList = read("src/components/recipes/SlotList.tsx");

  test("WISHLIST button is the warning (yellow border + text) outline style", () => {
    // Yellow border + yellow text, black fill == warning variant, outline
    // tone when inactive. Mirrors the app's other WISHLIST CTAs.
    expect(buttons).toMatch(/variant="warning"/);
    expect(buttons).toContain("Wishlist");
  });

  test("OWNED button is the success (neon-green border + text) outline style", () => {
    expect(buttons).toMatch(/variant="success"/);
    expect(buttons).toContain("Mark owned");
  });

  test("toggles route through the shared inventory action path", () => {
    // Reuses the exact server actions the library InventoryControls uses.
    expect(buttons).toContain("toggleWishlistedPaint");
    expect(buttons).toContain("setOwnedCount");
  });

  test("only renders for the slot's selected catalog paint", () => {
    // No clear selected-paint context on the add path / custom-hex slots.
    expect(slotList).toContain("selectedPaintId && selectedPaintInventory");
    expect(slotList).toContain("<RecipeInventoryButtons");
  });
});

describe("Item 4 — Inspo section on the recipe creator", () => {
  test("RecipeInspo renders a table persisting links via the inspo actions", () => {
    const src = read("src/components/recipes/RecipeInspo.tsx");
    expect(src).toContain('title="Inspo"');
    expect(src).toContain("<table");
    expect(src).toContain("addInspo");
    expect(src).toContain("deleteInspo");
  });

  test("the editor client mounts the Inspo section", () => {
    const src = read("src/components/recipes/RecipeEditorClient.tsx");
    expect(src).toContain("RecipeInspo");
    expect(src).toContain("initialRows={inspo}");
  });
});

describe("Item 5 — balanced SLOTS/NOTES layout + full-width Inspo", () => {
  const src = read("src/components/recipes/RecipeEditorClient.tsx");

  test("SLOTS vs NOTES split on a proportional ratio (not 1fr / fixed px)", () => {
    expect(src).toContain("md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]");
    expect(src).not.toContain("md:grid-cols-[minmax(0,1fr)_320px]");
  });

  test("Inspo sits OUTSIDE the two-column grid (full container width)", () => {
    // The RecipeInspo mount is a sibling of the grid div, not inside it,
    // so it spans the full width and lines up with the columns above.
    const gridEnd = src.indexOf("</div>", src.indexOf("grid-cols-1"));
    const inspoIdx = src.indexOf("<RecipeInspo");
    expect(gridEnd).toBeGreaterThan(-1);
    expect(inspoIdx).toBeGreaterThan(gridEnd);
  });

  test("the editor page widens its canvas for the bigger slot grid", () => {
    const page = read("src/app/recipes/[id]/page.tsx");
    expect(page).toContain("max-w-[96rem]");
    expect(page).not.toContain("max-w-7xl");
  });
});

describe("B5 — single 'Recipe notes' box", () => {
  test("RecipeNotes card title reads 'Recipe notes'", () => {
    const src = read("src/components/recipes/RecipeNotes.tsx");
    expect(src).toContain('title="Recipe notes"');
    expect(src).not.toContain('title="Notes"');
  });
});
