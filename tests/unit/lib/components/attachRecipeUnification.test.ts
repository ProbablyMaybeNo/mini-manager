/**
 * UX-904 — Unified attach-recipe modal across surfaces.
 *
 * Audit found three project→recipe attach paths producing different
 * outcomes:
 *
 *   (a) /recipes/[id] → ASSIGN TO PROJECT ▼  → attaches the existing
 *       recipe to the picked project. (recipe-side, different direction
 *       — out of scope here.)
 *   (b) /projects table → + ATTACH per row  → was reported as auto-
 *       creating an empty recipe named "<project> scheme". In fact the
 *       cell already opens AttachRecipeModal — the audit's observation
 *       was likely outdated or stale.
 *   (c) /projects/[id] COLOR SCHEME box → + tile  → previously called
 *       handleCreateRecipeAndOpenPicker which immediately created an
 *       auto-named recipe with no chance to pick an existing one.
 *
 * Fix: (b) and (c) now both open the SAME AttachRecipeModal with two
 * tabs ("Pick existing" + "Create new"). This file locks the wiring.
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

describe("AttachRecipeModal — two-tab contract (UX-904)", () => {
  const src = read("src/components/recipes/AttachRecipeModal.tsx");

  test("modal exposes a 'Pick existing' tab", () => {
    // UX-1306 — tabs are now driven by the shared SegmentedControl.
    expect(src).toContain('label: "Pick existing"');
  });

  test("modal exposes a 'Create new' tab", () => {
    expect(src).toContain('label: "Create new"');
  });

  test("Pick existing tab attaches via the existing attachRecipeToProject action", () => {
    // The Pick flow MUST reuse the same server action /recipes/[id]'s
    // Assign-to-project dropdown calls. Single source of truth for
    // attach semantics.
    expect(src).toContain("attachRecipeToProject");
  });

  test("Create new tab creates a fresh recipe attached to the project", () => {
    expect(src).toContain("createRecipe");
    expect(src).toContain("attachedProjectId: props.projectId");
  });
});

describe("ProjectColorSchemeBox — opens the unified modal (UX-904)", () => {
  const src = read("src/components/ProjectColorSchemeBox.tsx");

  test("imports AttachRecipeModal from the recipe components", () => {
    expect(src).toContain(
      'from "@/components/recipes/AttachRecipeModal"',
    );
  });

  test("does NOT call createRecipe directly any more", () => {
    // The old handleCreateRecipeAndOpenPicker silently created an
    // auto-named "<project> scheme" recipe — the audit's exact
    // complaint. Lock its removal.
    expect(src).not.toContain("createRecipe(");
    expect(src).not.toContain("handleCreateRecipeAndOpenPicker");
  });

  test("renders AttachRecipeModal", () => {
    expect(src).toContain("<AttachRecipeModal");
    expect(src).toContain('mode="project"');
  });

  test("accepts attachCandidates prop so the modal's Pick tab is populated", () => {
    expect(src).toContain("attachCandidates");
    expect(src).toContain("RecipeOption");
  });

  test("the + ghost opens the modal (not an immediate create) when no recipe is attached", () => {
    // Locks the wiring: unattached + tile → setAttachOpen(true).
    expect(src).toMatch(/setAttachOpen\(true\)/);
  });
});

describe("ProjectsDashboardTable — already uses the unified modal", () => {
  const src = read("src/components/ProjectsDashboardTable.tsx");

  test("imports AttachRecipeModal", () => {
    expect(src).toContain("AttachRecipeModal");
  });

  test("the recipe cell opens the modal when no recipe is attached (no auto-create)", () => {
    // Recipe-cell click branch: attached → route to /recipes/<id>;
    // empty → open the modal. Lock the empty branch's modal trigger.
    expect(src).toMatch(/setAttachOpen\(true\)/);
  });
});

describe("project inspector wires attachCandidates (FIGMA-REBUILD §9)", () => {
  // FIGMA-REBUILD §9 — the /projects/[id] detail page became the slide-out
  // ProjectInspector. The attach-candidate plumbing moved into its server
  // data action (projectInspectorActions.ts): the same lean owned-recipes
  // list, filtered to drop recipes already on this project, surfaced as the
  // inspector's ASSIGN dropdown candidates.
  const action = read("src/components/projects/projectInspectorActions.ts");
  const panel = read("src/components/projects/ProjectInspector.tsx");

  test("fetches listOwnedRecipesLean for the candidate list", () => {
    expect(action).toContain("listOwnedRecipesLean");
  });

  test("filters out recipes already attached to this project from the candidate list", () => {
    expect(action).toContain("r.attachedProjectId !== project.id");
  });

  test("the inspector renders the attachCandidates as an ASSIGN dropdown", () => {
    expect(action).toContain("attachCandidates:");
    expect(panel).toContain("vm.attachCandidates");
  });
});
