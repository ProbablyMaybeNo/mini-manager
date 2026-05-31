/**
 * P11.3 — Recipe editor "Zone" → "Color slot" UI rename.
 *
 * The schema, server actions, and underlying table (`recipe_zone`)
 * intentionally keep the word "zone" — only user-facing strings flip.
 * These tests pin the visible labels so a future grep-and-replace
 * can't accidentally drag the data layer back into the UI vocabulary.
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

describe("ZoneList — UI strings flipped to 'colour slot' (P11.3)", () => {
  const src = read("src/components/recipes/ZoneList.tsx");

  test("Card title uses 'Color slots ·' instead of 'Zones ·'", () => {
    expect(src).toContain("Color slots · ");
    expect(src).not.toContain("title={`Zones · ");
  });

  test("primary CTA reads '+ Add color' instead of 'Add zone'", () => {
    expect(src).toContain("+ Add color");
    expect(src).not.toContain(">Add zone</");
    expect(src).not.toContain(">Add zone<");
  });

  test("secondary CTA reads 'Use a starter set' not 'Use starter zones'", () => {
    expect(src).toContain("Use a starter set");
    expect(src).not.toContain("Use starter zones");
  });

  test("validation error talks about 'Slot' not 'Zone'", () => {
    expect(src).toContain("Slot name is required");
    expect(src).not.toContain("Zone name is required");
  });

  test("empty-state copy references 'colour slots' not 'zones'", () => {
    expect(src).toContain("No colour slots yet");
  });

  test("inline help microcopy explains what a slot is", () => {
    // Plain-prose one-liner under the section heading per P11.12.
    expect(src).toMatch(/Each colour slot is one part of the model/);
  });

  test("delete confirm prompt + aria-label use 'colour slot'", () => {
    expect(src).toContain("Delete colour slot");
  });

  test("schema-level server actions still imported under their original names", () => {
    // The data layer is untouched — `addZone`, `reorderZones`, etc. remain.
    expect(src).toContain("addZone,");
    expect(src).toContain("reorderZones,");
    expect(src).toContain("deleteZone,");
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
