/**
 * P11.3 + P12.2 — Recipe editor "Zone" → "Color slot" UI vocabulary.
 *
 * The schema, table (`recipe_zone`), and most server actions
 * intentionally keep the word "zone" — only user-facing strings flip.
 * P12.2 then rewired the click behaviour so picking a paint creates a
 * fully-formed slot via the new `addSlotWithPaint` server action; the
 * old free-text "Add zone" name input + starter-pack dropdown were
 * dropped per Ross's brief ("recipes are about COLOR, not parts of a
 * model"). These tests pin the visible vocabulary so a future grep-
 * and-replace can't accidentally drag the data layer back into the UI.
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

describe("ZoneList — UI strings flipped to 'colour slot' (P11.3 + P12.2)", () => {
  const src = read("src/components/recipes/ZoneList.tsx");

  test("Card title uses 'Color slots ·' instead of 'Zones ·'", () => {
    expect(src).toContain("Color slots · ");
    expect(src).not.toContain("title={`Zones · ");
  });

  test("the AddSlotTile carries the 'Add color' label", () => {
    // P12.2 replaced the free-text "+ Add color" Button with an
    // AddSlotTile that opens the ColorPicker side panel. The visible
    // label remains "Add color" — Ross's locked vocabulary.
    expect(src).toContain("Add color");
    expect(src).not.toContain(">Add zone</");
    expect(src).not.toContain(">Add zone<");
  });

  test("empty-state copy references 'colour slots' not 'zones'", () => {
    // P12.2 rewrote the empty-state copy to point at the + tile.
    expect(src).toContain("No colour slots yet");
    expect(src).not.toContain("No zones yet");
  });

  test("inline help microcopy points the user at the + slot", () => {
    // P11.12's "Each colour slot is one part of the model" copy was
    // retired in P12.2 — Ross's brief locks "recipes are about COLOR
    // and PAINTS, not parts of a model". The replacement microcopy
    // points the user at the click-to-pick affordance.
    //
    // R7-002 then rewrote the copy to disambiguate ADD vs REPLACE vs
    // layer-on-step. The "Click any +" anchor stays; the verb is now
    // ADD and the swap path is REPLACE. The layer-via-Steps escape
    // hatch is called out by name.
    expect(src).toContain("Click any");
    expect(src).toContain("slot to ADD a new colour");
    expect(src).toContain("REPLACE its");
    expect(src).toContain("+ Add step");
    expect(src).not.toMatch(/one part of the model/);
  });

  test("delete confirm prompt + aria-label use 'colour slot'", () => {
    expect(src).toContain("Delete colour slot");
  });

  test("schema-level server actions still imported under their original names", () => {
    // The data layer is untouched — `reorderZones` + `deleteZone` keep
    // their original names. `addSlotWithPaint` is the new one-shot
    // action introduced in P12.2 (zone + first basecoat step) which
    // supersedes the bare `addZone` import in this file.
    expect(src).toContain("addSlotWithPaint,");
    expect(src).toContain("reorderZones,");
    expect(src).toContain("deleteZone,");
  });

  test("the starter-set preset dropdown is gone", () => {
    // P12.2 drops the "Use a starter set" affordance entirely. Model-
    // part presets are out of scope per Ross's brief.
    expect(src).not.toContain("Use a starter set");
    expect(src).not.toContain("StarterZonesControl");
    expect(src).not.toContain("ZONE_PRESET_KEYS");
  });

  test("the ColorPicker primitive is wired into the slot flow", () => {
    // The keystone of P12.2 — clicking any slot or the + tile opens
    // the ColorPicker side panel.
    expect(src).toContain("ColorPicker");
    expect(src).toContain("ColorPickerSidePanel");
  });
});

describe("Recipe surfaces — concrete-over-abstract sweep (P11.3)", () => {
  test("AttachedRecipeSummary empty state mentions 'colour slots'", () => {
    const src = read("src/components/recipes/AttachedRecipeSummary.tsx");
    expect(src).toContain("No colour slots yet");
    expect(src).not.toContain("No zones yet");
  });

  test("RecipeCard empty hint mentions 'colour slots'", () => {
    const src = read("src/components/recipes/RecipeCard.tsx");
    expect(src).toContain("empty — no colour slots yet");
  });

  test("RecipeCard plural counter renders 'slot/slots' not 'zone/zones'", () => {
    const src = read("src/components/recipes/RecipeCard.tsx");
    expect(src).toContain("slot{zoneCount === 1 ? \"\" : \"s\"}");
  });

  test("PublicRecipeView empty state mentions 'colour slots'", () => {
    const src = read("src/components/recipes/PublicRecipeView.tsx");
    expect(src).toContain("This recipe has no colour slots yet");
  });

  test("PublicRecipeView count renders 'colour slot/colour slots'", () => {
    const src = read("src/components/recipes/PublicRecipeView.tsx");
    expect(src).toContain("colour slot");
  });

  test("RecipeEditorClient mobile pane tab reads 'Slots' not 'Zones'", () => {
    const src = read("src/components/recipes/RecipeEditorClient.tsx");
    expect(src).toContain('label: "Slots"');
    expect(src).not.toContain('label: "Zones"');
  });

  test("RecipeEditorClient selection prompt mentions 'colour slot'", () => {
    const src = read("src/components/recipes/RecipeEditorClient.tsx");
    expect(src).toContain("Select a colour slot");
  });

  test("SendToRecipeModal labels read 'Colour slot' / 'New slot'", () => {
    const src = read("src/components/tools/SendToRecipeModal.tsx");
    expect(src).toContain("Colour slot");
    expect(src).toContain("Add new slot");
  });
});
