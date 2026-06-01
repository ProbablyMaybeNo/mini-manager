/**
 * R7-007 — required-name prompt on NEW RECIPE.
 *
 * The auditor flagged that the previous one-click "New recipe" flow
 * silently filed every row as "Untitled recipe", and recruits piled
 * up six of them after three sessions. The R7-007 fix replaces the
 * one-shot Button with a Button + name-prompt dialog: the painter has
 * to type a name (or hit Cancel) before the recipe row hits the
 * library.
 *
 * Source-text assertions — NewRecipeButton is `'use client'` with a
 * transitive server-action import that crashes a Node-only test env.
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

describe("NewRecipeButton — R7-007 required-name prompt", () => {
  const src = read("src/components/recipes/NewRecipeButton.tsx");

  test("renders a <dialog> hosting the name prompt", () => {
    expect(src).toContain("<dialog");
    expect(src).toContain("aria-label=\"Name your recipe\"");
  });

  test("the dialog has a required text input", () => {
    expect(src).toMatch(/type="text"[\s\S]*?required/);
    expect(src).toContain('placeholder="Skin · gold trim · battle dust"');
  });

  test("submit is disabled when the trimmed name is empty", () => {
    expect(src).toContain("disabled={isPending || name.trim().length === 0}");
  });

  test("createRecipe receives the trimmed, non-empty name", () => {
    expect(src).toContain("const trimmed = name.trim();");
    expect(src).toContain("if (trimmed.length === 0)");
    expect(src).toContain("name: trimmed,");
  });

  test("no 'Untitled recipe' string is hard-coded as the default", () => {
    // The prop default was `"Untitled recipe"` pre-R7. Now defaults to
    // empty string — the dialog renders an empty input that the user
    // has to fill in. The phrase still appears in the error microcopy
    // ("six 'Untitled recipe' rows piles up fast") but never as a
    // default name handed to createRecipe.
    expect(src).toContain('defaultName = "",');
    // Search a window around the createRecipe call to confirm no
    // hard-coded fallback name slipped through.
    const callIdx = src.indexOf("createRecipe({");
    expect(callIdx).toBeGreaterThan(0);
    const callBlock = src.slice(callIdx, callIdx + 300);
    expect(callBlock).not.toContain("Untitled recipe");
    expect(callBlock).toContain("name: trimmed,");
  });

  test("Esc / backdrop / Cancel close the dialog without creating", () => {
    expect(src).toContain("const close = ()");
    expect(src).toContain("setOpen(false)");
    // The close handler bails when a save is in flight so a half-
    // submitted form doesn't get lost.
    expect(src).toContain("if (isPending) return");
  });

  test("auto-focus the input on open so typing starts immediately", () => {
    expect(src).toContain("inputRef.current?.focus()");
  });

  test("error microcopy points at the library scannability problem", () => {
    expect(src).toContain("library scannable");
    expect(src).toContain('"Untitled recipe" rows piles up fast.');
  });

  test("the Create submit button uses variant='success' (R7-006 lock)", () => {
    // Stays aligned with the R7-006 cyan-purge: ADD/CREATE → success.
    expect(src).toMatch(/variant="success"[\s\S]*?Creating…/);
  });
});
