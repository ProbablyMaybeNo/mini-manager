/**
 * P12.5 — Recipes list table redesign.
 *
 * The /recipes page replaces the prior three-section card grid with
 * a single sortable table. Per-row actions: Assign ▾ (cyan) + Share
 * (yellow/warning). Click name → /recipes/<id> editor.
 *
 * Component source-level pins. The table itself is a 'use client'
 * module — we read source as text rather than importing it directly
 * to avoid React-DOM hooks crashing the Node-only test environment.
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

describe("RecipesTable component surface", () => {
  const src = read("src/components/recipes/RecipesTable.tsx");

  test("renders a <table> element (not a card grid)", () => {
    expect(src).toContain("<table");
    expect(src).toContain("<thead");
    expect(src).toContain("<tbody");
  });

  test("Name column links into the editor", () => {
    expect(src).toContain("`/recipes/${row.id}`");
  });

  test("the row Assign action is the inline project dropdown (not a navigate)", () => {
    // Item 1: the row's ASSIGN opens a dropdown of projects and attaches
    // the recipe in place — it does NOT navigate to the recipe creator.
    expect(src).toContain("AssignToProjectMenu");
  });

  test("the Assign-dropdown trigger uses variant='success' (green) per R7-006", () => {
    // R7-006 — ATTACH / ASSIGN actions flipped off cyan. Green is the
    // Round-7 semantic for ADD / ATTACH / ASSIGN; cyan stays for
    // auth and final-step confirms only.
    const menu = read("src/components/recipes/AssignToProjectMenu.tsx");
    expect(menu).toMatch(/variant="success"[\s\S]{0,400}Assign/);
  });

  test("the Assign dropdown attaches via attachRecipeToProject (shared path)", () => {
    const menu = read("src/components/recipes/AssignToProjectMenu.tsx");
    expect(menu).toContain("attachRecipeToProject");
    // It stays on the list (refresh) rather than navigating away.
    expect(menu).toContain("router.refresh()");
  });

  test("the Share-row-action uses variant='warning' (pastel yellow)", () => {
    // Locked discipline in P12.23: SHARE / IMPORT / EXPORT / ADD-TO-WL
    // all use the warning (pastel-yellow) variant.
    expect(src).toMatch(/variant="warning"[\s\S]{0,200}Share/);
  });

  test("sortable by name + updated; body / slots sorts removed (Item 2)", () => {
    expect(src).toContain('"name"');
    expect(src).toContain('"updatedAt"');
    // Item 2: the body-type + slot-count columns (and their sorts) are gone.
    expect(src).not.toMatch(/SortKey = [^;]*"bodyType"/);
    expect(src).not.toMatch(/SortKey = [^;]*"slotCount"/);
    // Flat model: no separate step count column / sort.
    expect(src).not.toContain('"stepCount"');
  });

  test("default sort = updatedAt desc", () => {
    expect(src).toContain('useState<SortKey>("updatedAt")');
    expect(src).toContain('useState<SortDir>("desc")');
  });

  test("rows render creator-sized paint squares (w-12 h-12), not w-4 chips", () => {
    // Item 1: /recipes is the primary recipe-access surface, so each row
    // renders its paints at the SAME size as the recipe creator
    // (w-12 h-12) with the paint name + layer, not a tiny w-4 strip.
    expect(src).toContain("w-12 h-12");
    expect(src).not.toContain("w-4 h-4");
  });

  test("each square shows the paint name + the layer label", () => {
    expect(src).toContain("slot.paintLabel");
    expect(src).toContain("slot.layerLabel");
  });

  test("a colour-only slot with no paint shows a + Assign Paint affordance", () => {
    // Item 1: a slot that's just a colour with no catalog paint assigned
    // renders a "+ Assign Paint" call to action (black/white per contrast)
    // instead of a name.
    expect(src).toContain("slot.needsPaint");
    expect(src).toMatch(/\+ Assign/);
    expect(src).toContain("readableTextOn");
  });

  test("clicking a paint square navigates to the recipe creator", () => {
    expect(src).toMatch(/router\.push\(`\/recipes\/\$\{recipeId\}`\)/);
  });

  test("a recipe with no palette renders an explanatory hint", () => {
    expect(src).toContain("no palette yet");
  });

  test("ISO-ish date formatting (YYYY-MM-DD) keeps the column sortable visually", () => {
    // The locale 'localeCompare' over an ISO date sorts lexicographically
    // correctly, which is the cheap-and-correct trick this column uses.
    expect(src).toMatch(/YYYY-MM-DD|formatDate/);
  });
});

describe("RecipesTable — Ross's locked column set", () => {
  const src = read("src/components/recipes/RecipesTable.tsx");

  test("columns: Name / Palette / Attached / Updated / Actions (Item 2 trim)", () => {
    // Sortable columns pass label= prop to <Th>; non-sortable
    // columns render the text directly inside <th>.
    expect(src).toContain('label="Name"');
    expect(src).toContain("Palette");
    expect(src).toContain("Attached to");
    expect(src).toContain('label="Updated"');
    expect(src).toContain("Actions");
    // Item 2: the body-type column ("INFANTRY") is gone — no "body" to
    // assign in the flat recipe model.
    expect(src).not.toContain('label="Body"');
    // Item 2: the slot-count column is gone (the painter counts squares).
    expect(src).not.toContain('label="Slots"');
    // Flat model: the separate Steps column is gone.
    expect(src).not.toContain('label="Steps"');
  });

  test("paint squares carry the owned/wishlist border (Item 2)", () => {
    // Item 2: bigger squares get the green = owned / yellow = wishlist
    // border indicator, reusing the existing coverage treatment.
    expect(src).toContain("coverageBorder(slot.coverage)");
    expect(src).toMatch(/coverage === "owned"[\s\S]{0,80}var\(--color-green\)/);
    expect(src).toMatch(/coverage === "wanted"[\s\S]{0,80}var\(--color-yellow\)/);
  });
});

// DASH-RECIPES (2026-06-05) — the dashboard recipes table was removed.
// /recipes is the single primary surface for the recipe list, so the
// dashboard no longer duplicates it. The DashboardRecipesTable variant +
// its `listRecipesForDashboard` query were deleted (nothing else used
// them). The dashboard must NOT reference either any more.
describe("DASHBOARD page no longer renders the recipes table", () => {
  const page = read("src/app/projects/page.tsx");
  const table = read("src/components/recipes/RecipesTable.tsx");

  test("the dashboard page drops the recipes table import + query + mount", () => {
    expect(page).not.toContain("DashboardRecipesTable");
    expect(page).not.toContain("listRecipesForDashboard");
    expect(page).not.toMatch(/<Card title="RECIPES"/);
  });

  test("the dead DashboardRecipesTable component is gone from the module", () => {
    expect(table).not.toContain("DashboardRecipesTable");
    expect(table).not.toContain("DashboardRecipeRowVm");
    expect(table).not.toContain("DashboardRecipeSlotVm");
  });
});

describe("Recipes page wires the table in", () => {
  const src = read("src/app/recipes/page.tsx");

  test("imports RecipesTable + listRecipesForTable", () => {
    expect(src).toContain("RecipesTable");
    expect(src).toContain("listRecipesForTable");
  });

  test("the old three-section card grid is gone", () => {
    expect(src).not.toContain("Standalone · ");
    expect(src).not.toContain("Attached to projects · ");
    expect(src).not.toContain("RecipeCard");
  });

  test("the empty-state copy reflects the new picker flow", () => {
    // Updated copy mentions the + slot + the three picker modes
    // (wheel / library / eyedropper) introduced in P12.1/P12.2.
    expect(src).toContain("click a + slot");
    expect(src).toContain("wheel / library / eyedropper");
  });
});
