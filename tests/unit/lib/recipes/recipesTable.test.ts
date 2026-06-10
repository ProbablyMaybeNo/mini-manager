/**
 * FIGMA-REBUILD §5 — Recipes list table (Recipe.png).
 *
 * Source-level pins for the rebuilt /recipes table: step-colour chips,
 * PROJECT assign dropdown (purple accent), SHARE row action, trailing
 * + RECIPE create row.
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

describe("RecipesTable component surface (FIGMA rebuild)", () => {
  const src = read("src/components/recipes/RecipesTable.tsx");

  test("renders a <table> with RECIPE / PROJECT / SHARE columns", () => {
    expect(src).toContain("<table");
    expect(src).toContain("Recipe");
    expect(src).toContain("Project");
    expect(src).toContain("Share");
  });

  test("Name column links into the editor; row click navigates too", () => {
    expect(src).toContain("`/recipes/${row.id}`");
    expect(src).toContain("router.push(`/recipes/${row.id}`)");
  });

  test("inline AssignToProjectMenu on each row", () => {
    expect(src).toContain("AssignToProjectMenu");
  });

  test("Assign dropdown uses purple accent (FIGMA mock)", () => {
    const menu = read("src/components/recipes/AssignToProjectMenu.tsx");
    expect(menu).toContain("color-purple-pastel");
    expect(menu).toContain("attachRecipeToProject");
    expect(menu).toContain("router.refresh()");
  });

  test("Share uses variant warning (yellow outline)", () => {
    expect(src).toMatch(/variant="warning"[\s\S]{0,200}Share/);
  });

  test("RECIPE column uses small step-colour chips (h-6 w-6)", () => {
    expect(src).toContain("h-6 w-6");
    expect(src).toContain("RecipeStepChips");
    expect(src).not.toContain("w-28 h-28");
  });

  test("trailing + RECIPE row via NewRecipeButton trigger=row", () => {
    expect(src).toContain('trigger="row"');
    expect(src).toContain("NewRecipeButton");
  });

  test("sortable by name + updatedAt; default updatedAt desc", () => {
    expect(src).toContain('"updatedAt"');
    expect(src).toContain('useState<SortKey>("updatedAt")');
    expect(src).toContain('useState<SortDir>("desc")');
  });

  test("owned/wishlist chip rings preserved", () => {
    expect(src).toContain("coverageBorder(slot.coverage)");
  });
});

describe("DASHBOARD page no longer renders the recipes table", () => {
  const page = read("src/app/projects/page.tsx");

  test("no DashboardRecipesTable mount", () => {
    expect(page).not.toContain("DashboardRecipesTable");
    expect(page).not.toMatch(/<Card title="RECIPES"/);
  });
});

describe("Recipes page wires the table in", () => {
  const src = read("src/app/recipes/page.tsx");

  test("imports RecipesTable + PageHeader", () => {
    expect(src).toContain("RecipesTable");
    expect(src).toContain("PageHeader");
    expect(src).toContain('accent="red"');
  });
});
