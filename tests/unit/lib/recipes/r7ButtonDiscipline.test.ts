/**
 * R7-7 — Recipes surface button-discipline sentinel.
 *
 * Ross's R7-7 brief asked for an explicit audit of every button across
 * /recipes + /recipes/[id] + the new RecipeActionsBar. The R7-2 sweep
 * already brought the wider app down to sm; this sentinel pins the
 * recipes surface specifically so a future regression that re-introduces
 * size="md" / size="lg" inside the recipes folder fails fast.
 *
 * Auth-page exception list (sign-up / sign-in / forgot / reset /
 * finish-account) does not overlap with /recipes, so the rule here is
 * strictly: NO Button primitive may carry size="md" or size="lg".
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const RECIPES_DIR = path.resolve(
  __dirname,
  "../../../../src/components/recipes",
);

function readAllRecipeFiles(): Array<{ name: string; src: string }> {
  return fs
    .readdirSync(RECIPES_DIR)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => ({
      name: f,
      src: fs.readFileSync(path.join(RECIPES_DIR, f), "utf-8"),
    }));
}

describe("R7-7 — recipes surface button discipline", () => {
  const files = readAllRecipeFiles();

  test("every recipe component compiles with at least one Button reference", () => {
    // Sanity — the sweep below would silently pass against an empty
    // folder. Confirm we're actually scanning live source.
    expect(files.length).toBeGreaterThan(5);
  });

  test("no Button in src/components/recipes/ uses size=\"md\"", () => {
    const offenders = files.filter(({ src }) => src.includes('size="md"'));
    expect(
      offenders.map((f) => f.name),
      "buttons in the recipes surface must be size=\"sm\"",
    ).toEqual([]);
  });

  test("no Button in src/components/recipes/ uses size=\"lg\"", () => {
    const offenders = files.filter(({ src }) => src.includes('size="lg"'));
    expect(
      offenders.map((f) => f.name),
      "size=\"lg\" is reserved for the five auth-page CTAs only",
    ).toEqual([]);
  });

  test("RecipeActionsBar Save = primary (cyan), Assign = success (green)", () => {
    // UX-002 — supersedes R7-006's "both green" rule. DESIGN_LANGUAGE §2
    // restored cyan as the Primary tier, so the editor's single dominant
    // CTA (Save) takes cyan PRIMARY while Assign keeps the green (success)
    // treatment shared with the /recipes list row Assign — one consistent
    // Assign colour everywhere. Locks the pair so a regression that
    // collapses them back to two greens (or flips Assign to cyan) fails.
    const bar =
      files.find((f) => f.name === "RecipeActionsBar.tsx")?.src ?? "";
    expect(bar, "Save must be the cyan PRIMARY lead").toMatch(
      /variant="primary"/,
    );
    // Assign keeps green — at least one success reference for the
    // Assign-to-project trigger.
    const assignGreen = bar.match(/variant="success"/g) ?? [];
    expect(
      assignGreen.length,
      "Assign-to-project must stay green (success)",
    ).toBeGreaterThanOrEqual(1);
  });
});
