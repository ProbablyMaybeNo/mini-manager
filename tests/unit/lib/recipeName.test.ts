import { describe, expect, test } from "vitest";
import {
  isNamedRecipe,
  PLACEHOLDER_RECIPE_NAME,
  UNNAMED_RECIPE_GALLERY_ERROR,
} from "@/lib/recipes/name";

/**
 * R4-5 — what counts as "the painter has named this recipe". The recipe's
 * name is the share card's headline, so this predicate is what stands between
 * the auto-name and the public gallery.
 */
describe("isNamedRecipe", () => {
  test("a real name passes", () => {
    expect(isNamedRecipe("Salamanders Green")).toBe(true);
    expect(isNamedRecipe("  Dark Prussian Blue scheme  ")).toBe(true);
  });

  test("the auto-name does not, whatever its casing or padding", () => {
    expect(isNamedRecipe(PLACEHOLDER_RECIPE_NAME)).toBe(false);
    expect(isNamedRecipe("untitled recipe")).toBe(false);
    expect(isNamedRecipe("UNTITLED RECIPE")).toBe(false);
    expect(isNamedRecipe("  Untitled recipe ")).toBe(false);
  });

  test("blank, whitespace and absent names do not", () => {
    expect(isNamedRecipe("")).toBe(false);
    expect(isNamedRecipe("   ")).toBe(false);
    expect(isNamedRecipe(null)).toBe(false);
    expect(isNamedRecipe(undefined)).toBe(false);
  });

  test("a name that merely contains the placeholder is still a name", () => {
    // "Untitled recipe" is the exact auto-name; a painter who writes
    // "Untitled recipe no. 2" has made a choice and keeps it.
    expect(isNamedRecipe("Untitled recipe no. 2")).toBe(true);
    expect(isNamedRecipe("Sort-of untitled recipe")).toBe(true);
  });

  test("the refusal says what to do about it", () => {
    // The composer's caption, its click refusal and the server action all read
    // this one string — a disabled control with no explanation was the thing
    // the finding explicitly ruled out.
    expect(UNNAMED_RECIPE_GALLERY_ERROR).toMatch(/name/i);
    expect(UNNAMED_RECIPE_GALLERY_ERROR).toMatch(/gallery/i);
  });
});
