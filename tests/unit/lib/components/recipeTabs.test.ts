/**
 * UX-907 — RecipeTabs segmented control.
 *
 * Source-string assertions on the tab component + its mount points. The
 * component is a client component that ships hooks (useRouter,
 * useSearchParams), so the unit project — which has no Next runtime —
 * can't render it interactively. We pin the structural contract via
 * source inspection (same pattern the colorSchemeBox / focusSectionMounted
 * tests use) so a regression on the prop contract or mount sites fails
 * deterministically.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("RecipeTabs primitive (UX-907)", () => {
  const src = read("src/components/focus/RecipeTabs.tsx");

  test("renders nothing for < 2 recipes — preserves single-recipe layout", () => {
    expect(src).toContain("if (recipes.length < 2) return null");
  });

  test("uses the P13.1 Button primitive with success variant", () => {
    expect(src).toContain('variant="success"');
    // No raw <button>s — must go through the Button primitive.
    expect(src).not.toMatch(/<button(\s|\/>)/);
  });

  test("active tab ships solid, inactive ships tone='outline'", () => {
    expect(src).toContain('tone={isActive ? "solid" : "outline"}');
  });

  test("does NOT use cyan — cyan is banned from action affordances", () => {
    expect(src).not.toMatch(/variant=["']primary["']/);
    expect(src).not.toMatch(/variant=["']secondary["']/);
  });

  test("writes the active recipe id into the URL via router.replace", () => {
    expect(src).toContain("router.replace");
    expect(src).toContain("URLSearchParams");
    // The default param key for the dashboard panel is `focusRecipe`.
    expect(src).toContain('paramKey = "focusRecipe"');
  });

  test("emits ARIA tablist semantics", () => {
    expect(src).toContain('role="tablist"');
    expect(src).toContain('role="tab"');
    expect(src).toContain("aria-selected={isActive}");
  });

  test("paramKey is configurable so multiple surfaces can scope", () => {
    // The /projects/[id] page uses `recipe`; the dashboard uses
    // `focusRecipe`. Both surfaces must drive the same primitive.
    expect(src).toContain("paramKey?: string");
  });
});

describe("FocusPanel — recipe tabs wiring (UX-907)", () => {
  const src = read("src/components/focus/FocusPanel.tsx");

  test("imports + mounts RecipeTabs", () => {
    expect(src).toContain('import { RecipeTabs');
    expect(src).toContain("<RecipeTabs");
  });

  test("only renders tabs when 2+ recipes are present", () => {
    // The boolean must guard against the single-recipe case at the
    // mount site too (defence in depth — RecipeTabs also self-guards).
    expect(src).toContain("tabRecipes.length >= 2");
  });

  test("accepts recipes + activeRecipeId props", () => {
    expect(src).toContain("recipes?: ReadonlyArray<RecipeTab>");
    expect(src).toContain("activeRecipeId?: string");
  });

  test("tab strip uses the focusRecipe URL param", () => {
    expect(src).toContain('paramKey="focusRecipe"');
  });
});

describe("ProjectColorSchemeBox — recipe tabs wiring (UX-907)", () => {
  const src = read("src/components/ProjectColorSchemeBox.tsx");

  test("imports + mounts RecipeTabs when 2+ recipes attached", () => {
    expect(src).toContain('import { RecipeTabs');
    expect(src).toContain("attachedRecipes.length >= 2");
    expect(src).toContain("<RecipeTabs");
  });

  test("leaf workspace uses `recipe` param (not `focusRecipe`)", () => {
    // The dashboard FOCUS panel uses `focusRecipe`; the leaf workspace
    // uses `recipe` so the two surfaces' tab state doesn't collide.
    expect(src).toContain('paramKey="recipe"');
  });

  test("accepts an `attachedRecipes` prop array", () => {
    expect(src).toContain("attachedRecipes?: ReadonlyArray<RecipeTab>");
  });
});

describe("FOCUS page — focusRecipe URL param honour (UX-907)", () => {
  // FOCUS-DASH — the FOCUS bench (+ its focusRecipe wiring) moved to /planner.
  const src = read("src/app/planner/page.tsx");

  test("reads `focusRecipe` out of searchParams", () => {
    expect(src).toContain("params.focusRecipe");
  });

  test("threads the id through getFocusedRecipeBundle", () => {
    expect(src).toContain("getFocusedRecipeBundle(userId, focusRecipeId");
  });

  test("forwards allRecipes + recipe id to FocusPanel", () => {
    expect(src).toContain("recipes={focusBundle.allRecipes}");
    expect(src).toContain("activeRecipeId={focusBundle.recipe.id}");
  });
});

describe("/projects/[id] page — recipe URL param honour (UX-907)", () => {
  const src = read("src/app/projects/[id]/page.tsx");

  test("reads `recipe` out of searchParams", () => {
    expect(src).toContain("sp.recipe");
  });

  test("picks the matching recipe from attachedRecipes when the param is present", () => {
    expect(src).toMatch(
      /attachedRecipes\.find\(\(r\) => r\.id === recipeParam\)/,
    );
  });

  test("passes attachedRecipes through to ColorSchemeBox", () => {
    expect(src).toContain("attachedRecipes={attachedRecipes.map");
  });
});
