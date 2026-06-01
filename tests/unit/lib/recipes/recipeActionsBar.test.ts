/**
 * P12.4 — Save vs Assign actions on the recipe header.
 *
 * Ross's locked answer: Save button → adds to library (success-green
 * variant), Assign to project ▾ button → cyan/primary, opens dropdown,
 * on pick attaches + navigates to the destination project's page.
 *
 * These tests pin the visible component surface so a future refactor
 * can't accidentally drag the buttons back to ad-hoc Tailwind classes
 * or strip the navigate-on-pick behaviour. The component itself is a
 * `'use client'` module — we read the source as text rather than
 * importing it directly (the import chain pulls server actions that
 * crash a Node-only test environment).
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

describe("RecipeActionsBar component surface", () => {
  const src = read("src/components/recipes/RecipeActionsBar.tsx");

  test("the Save button uses the new success variant (green-filled)", () => {
    // Locked button discipline: Save / Add / Create → success green.
    expect(src).toMatch(/variant="success"/);
  });

  test("the Assign-to-project button uses success (green) per R7-006", () => {
    // R7-006 flipped the ATTACH / ASSIGN action off cyan. The button
    // is now green-filled to match the wider Round-7 rule (green for
    // ADD / ATTACH / SAVE; cyan reserved for auth + final-step
    // confirms only). Both Save AND Assign now match — they read as
    // paired commit actions on the recipe header.
    expect(src).toContain("Assign to project");
    const idx = src.lastIndexOf("Assign to project ▾");
    const before = src.slice(Math.max(0, idx - 400), idx);
    expect(before).toContain('variant="success"');
  });

  test("the Assign menu navigates to the destination project after attach", () => {
    // Ross's locked answer in the Q&A block: navigate to the project
    // after attach. The component uses router.push on success.
    expect(src).toContain("router.push(`/projects/${projectId}`)");
  });

  test("the Save button detaches when the recipe is already attached", () => {
    // Save semantics: for an attached recipe, Save = lift it back into
    // the standalone library. Calls detachRecipe under the hood.
    expect(src).toContain("detachRecipe");
  });

  test("the Save button shows a 'Saved ✓' flash for visible feedback", () => {
    expect(src).toContain("Saved ✓");
  });

  test("the menu filters projects by typed query", () => {
    // The dropdown is searchable — Ross's projects list will grow past
    // a single-screen menu so the affordance must support fast filter.
    expect(src).toMatch(/p\.name\.toLowerCase\(\)\.includes/);
  });

  test("the menu closes on outside click + Escape", () => {
    expect(src).toContain("document.addEventListener(\"mousedown\"");
    expect(src).toContain("Escape");
  });

  test("the current attachment is marked + disabled in the menu", () => {
    // Visual cue + UX guard: the painter can't re-attach to the project
    // the recipe is already on.
    expect(src).toContain("currentlyAttachedProjectId");
    expect(src).toContain("isCurrent");
  });

  test("attachRecipeToProject is the wired server action", () => {
    expect(src).toContain("attachRecipeToProject");
  });

  test("button labels Match Ross's locked vocabulary", () => {
    expect(src).toContain("Assign to project");
    // Save label is conditional: "Save" / "Save to library" / "Saved ✓"
    expect(src).toMatch(/"Save"/);
    expect(src).toMatch(/Save to library/);
  });
});

describe("RecipeHeader wires RecipeActionsBar in", () => {
  const src = read("src/components/recipes/RecipeHeader.tsx");

  test("RecipeHeader imports RecipeActionsBar", () => {
    expect(src).toContain("RecipeActionsBar");
  });

  test("RecipeHeader takes assignProjects prop", () => {
    expect(src).toContain("assignProjects");
  });

  test("RecipeHeader passes recipe.isStandalone + attached id to the bar", () => {
    expect(src).toContain("isStandalone={recipe.isStandalone}");
    expect(src).toContain(
      "currentlyAttachedProjectId={recipe.attachedProjectId}",
    );
  });
});

describe("Recipe editor page surfaces assignProjects", () => {
  const src = read("src/app/recipes/[id]/page.tsx");

  test("the page fetches the user's non-archived projects", () => {
    expect(src).toContain("assignProjects");
    expect(src).toContain("isNull(projects.archivedAt)");
  });

  test("the projects are passed into RecipeHeader", () => {
    expect(src).toContain("assignProjects={assignProjectsOptions}");
  });
});
