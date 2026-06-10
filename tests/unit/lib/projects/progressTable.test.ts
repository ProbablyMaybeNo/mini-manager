/**
 * P12.10 — Project detail Progress table.
 *
 * Single table replacing the prior sub-projects card + aggregated
 * stages. Ross's Q2 column set:
 *   Name · Type · Count (± steppers) · Color scheme · Status · Progress
 *
 * P13.4 — every row is a project row (named-model "kind" is gone
 * after the entity folded into Unit projects). The ± steppers apply
 * to every row.
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

describe("ProjectProgressTable component surface", () => {
  const src = read("src/components/ProjectProgressTable.tsx");

  test("locked column set: Name / Type / Count / Recipe / Status / Progress", () => {
    expect(src).toContain(">Name</th>");
    expect(src).toContain(">Type</th>");
    expect(src).toContain(">Count</th>");
    expect(src).toContain(">Recipe</th>");
    expect(src).not.toContain(">Color scheme</th>");
    expect(src).toContain(">Status</th>");
    expect(src).toContain(">Progress</th>");
  });

  test("Item 1 — the per-table ADD CTAs are gone (single header menu)", () => {
    // Item 1 (batch/army-project-page) removed the duplicated add
    // buttons from the table. The header strip's "+ Add ▾" menu is now
    // the only add entry point, so the table renders no add Buttons.
    expect(src).not.toContain("+ ADD UNIT");
    expect(src).not.toContain("+ ADD TERRAIN");
    expect(src).not.toContain('variant="success"');
    expect(src).not.toContain('"@/components/ui/Button"');
  });

  test("Item 1 — empty state points at the top + Add menu", () => {
    expect(src).toContain("+ Add");
    expect(src).toContain("menu at the top of the page");
  });

  test("every row carries ± steppers (P13.4 — named-model rows removed)", () => {
    expect(src).toContain("handleStep");
  });

  test("± steppers call updateProjectCount with the new total", () => {
    expect(src).toContain("updateProjectCount");
    expect(src).toContain("delta:");
  });

  test("status pill mapping covers all 8 DisplayStatus values", () => {
    for (const s of [
      "WISHLIST",
      "PURCHASED",
      "BUILDING",
      "PRIMING",
      "PAINTING",
      "BASING",
      "COMPLETE",
      "SHELVED",
    ]) {
      expect(src).toContain(s);
    }
  });

  test("empty state renders the locked ADD CTAs (Ross's brief)", () => {
    expect(src).toContain("No children yet");
  });

  test("rows clamp count to [0, 9999]", () => {
    // Same range as updateProjectCount zod schema.
    expect(src).toMatch(/Math\.max\(0,\s*Math\.min\(9999/);
  });

  test("PHASE-2 — table reads as the mission table (cyan-tinted phosphor frame)", () => {
    // Matches the dashboard ProjectsDashboardTable: near-black surface +
    // a 1px cyan-tinted border, density rows, and the cyan-highlighted
    // hover row with the inset left-edge marker.
    expect(src).toContain("var(--color-cyan) 28%, var(--color-border)");
    expect(src).toContain("mm-density-rows");
    expect(src).toContain("inset_2px_0_0_0_var(--color-cyan)");
  });

  test("PHASE-2 — row status renders as the solid colour-bar (tone=bar)", () => {
    expect(src).toContain('tone="bar"');
  });

  test("PHASE-2 — empty state is a terminal panel with ticks + label", () => {
    expect(src).toContain("panel panel-ticks");
    expect(src).toContain("panel-label");
  });
});

describe("updateProjectCount server action (P12.10)", () => {
  const src = read("src/lib/actions/projects.ts");

  test("exports updateProjectCount", () => {
    expect(src).toContain("export async function updateProjectCount");
  });

  test("validates count in [0, 9999]", () => {
    expect(src).toMatch(/count:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(9999\)/);
  });

  test("scopes by owner", () => {
    expect(src).toMatch(/eq\(projects\.ownerId,\s*userId\)/);
  });

  test("floors the cascade counters to the new count to satisfy the CHECK constraint", () => {
    // The schema's stage_cascade check requires
    // count >= ownedCount >= buildCount >= ... >= completeCount.
    // Lowering count below an existing stage count would fail SQL.
    // updateProjectCount clamps each stage on the way down.
    expect(src).toContain("Math.min(project.ownedCount, count)");
    expect(src).toContain("Math.min(project.completeCount, based)");
  });

  test("revalidates the affected paths (/projects + parent + self)", () => {
    expect(src).toContain('revalidatePath("/projects")');
    expect(src).toContain("revalidatePath(`/projects/${id}`)");
    expect(src).toContain(
      "revalidatePath(`/projects/${project.parentId}`)",
    );
  });
});

describe("Project children surface after the inspector rebuild (FIGMA-REBUILD §9)", () => {
  // FIGMA-REBUILD §9 — the /projects/[id] PAGE (which mounted the
  // ProjectProgressTable + the editable Roster/Stages counter cards) was
  // dissolved into the slide-out ProjectInspector. The inspector shows a
  // compact UNITS summary built from the project's children (name / count /
  // status / percent) loaded by projectInspectorActions.ts; the dense
  // ProjectProgressTable component is preserved for reuse (its surface
  // contract is pinned in the describe above). The route is a redirect.
  const action = read("src/components/projects/projectInspectorActions.ts");
  const panel = read("src/components/projects/ProjectInspector.tsx");
  const table = read("src/components/ProjectProgressTable.tsx");

  test("the inspector data action builds child rows (name / count / status / percent)", () => {
    expect(action).toContain("children:");
    expect(action).toContain("children.map");
    expect(action).toContain("listChildProjects");
  });

  test("the inspector renders the UNITS summary from the children", () => {
    expect(panel).toContain("vm.children");
    expect(panel).toContain("Units");
  });

  test("the ProjectProgressTable component is preserved (still a real table)", () => {
    expect(table).toContain("<table");
    expect(table).toContain(">Name</th>");
    expect(table).toContain(">Progress</th>");
  });
});
