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

  test("the Assign-row-action uses variant='success' (green) per R7-006", () => {
    // R7-006 — ATTACH / ASSIGN actions flipped off cyan. Green is the
    // Round-7 semantic for ADD / ATTACH / ASSIGN; cyan stays for
    // auth and final-step confirms only.
    expect(src).toMatch(/variant="success"[\s\S]{0,200}Assign/);
  });

  test("the Share-row-action uses variant='warning' (pastel yellow)", () => {
    // Locked discipline in P12.23: SHARE / IMPORT / EXPORT / ADD-TO-WL
    // all use the warning (pastel-yellow) variant.
    expect(src).toMatch(/variant="warning"[\s\S]{0,200}Share/);
  });

  test("sortable by every key the row carries", () => {
    expect(src).toContain('"name"');
    expect(src).toContain('"bodyType"');
    expect(src).toContain('"slotCount"');
    expect(src).toContain('"updatedAt"');
    // Flat model: no separate step count column / sort.
    expect(src).not.toContain('"stepCount"');
  });

  test("default sort = updatedAt desc", () => {
    expect(src).toContain('useState<SortKey>("updatedAt")');
    expect(src).toContain('useState<SortDir>("desc")');
  });

  test("PaletteStrip renders up to 8 swatches", () => {
    expect(src).toContain("swatches.slice(0, 8)");
  });

  test("PaletteStrip hover label shows the paint name (not just the hex)", () => {
    // Item 1: hovering a swatch shows the chosen paint's NAME (name
    // primary, hex secondary). Custom-colour slots fall back to the hex.
    expect(src).toContain("${sw.label} · ${sw.hex}");
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

  test("columns: Name / Body / Palette / Slots / Attached / Updated / Actions", () => {
    // Sortable columns pass label= prop to <Th>; non-sortable
    // columns render the text directly inside <th>.
    expect(src).toContain('label="Name"');
    expect(src).toContain('label="Body"');
    expect(src).toContain("Palette");
    expect(src).toContain('label="Slots"');
    // Flat model: the separate Steps column is gone.
    expect(src).not.toContain('label="Steps"');
    expect(src).toContain("Attached to");
    expect(src).toContain('label="Updated"');
    expect(src).toContain("Actions");
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
