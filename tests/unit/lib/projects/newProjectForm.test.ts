/**
 * batch/army-project-page — new-project page surface.
 *
 * Item 2: the form records the army's faction + the game/system it's
 *   built for, and the create action persists both.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("NewProjectForm — Item 2 faction + game fields", () => {
  const src = read("src/components/NewProjectForm.tsx");

  test("renders a Faction field wired to local state", () => {
    expect(src).toMatch(/Faction\s*<span/);
    expect(src).toContain("setFaction");
    expect(src).toContain("id={`${formId}-faction`}");
  });

  test("renders a Game field wired to local state", () => {
    expect(src).toMatch(/Game\s*<span/);
    expect(src).toContain("setGame");
    expect(src).toContain("id={`${formId}-game`}");
  });

  test("submits faction + game to createProject (blank → null)", () => {
    expect(src).toContain("faction: faction.trim() === \"\" ? null : faction.trim()");
    expect(src).toContain("game: game.trim() === \"\" ? null : game.trim()");
  });
});

describe("createProject — Item 2 schema persists faction + game", () => {
  const src = read("src/lib/actions/projects.ts");

  test("schema accepts faction + game", () => {
    expect(src).toMatch(/faction:\s*z[\s\S]{0,120}max\(80/);
    expect(src).toMatch(/game:\s*z[\s\S]{0,120}max\(80/);
  });

  test("insert writes faction + game columns", () => {
    expect(src).toContain("faction,");
    expect(src).toContain("game,");
  });
});

describe("Project schema — Item 2 game column", () => {
  const src = read("src/db/schema.ts");

  test("project table has a nullable game text column", () => {
    expect(src).toContain('game: text("game")');
  });

  test("faction column already existed (no migration needed for it)", () => {
    expect(src).toContain('faction: text("faction")');
  });
});

describe("Project type options — Item 3 TERRAIN rename, no VEHICLE", () => {
  const formSrc = read("src/components/NewProjectForm.tsx");
  const schemaSrc = read("src/db/schema.ts");

  test("the terrain option is labelled 'Terrain' (renders TERRAIN, drops 'Piece')", () => {
    // Label-only change: the stored enum value stays "Terrain Piece" but
    // the picker shows the friendly label "Terrain" (the `uppercase`
    // class renders it as TERRAIN). The option renders opt.label.
    expect(formSrc).toContain('label: "Terrain"');
    expect(formSrc).toContain("{opt.label ?? opt.type}");
  });

  test("Diorama is no longer a creatable option (selectable: false)", () => {
    // The "Diorama" enum value is retained so existing rows still
    // resolve, but it's filtered out of the new-project picker.
    expect(formSrc).toContain("selectable: false");
    expect(formSrc).toContain("m.selectable !== false");
  });

  test("the stored enum values are untouched (no risky migration)", () => {
    // Item 3 is a label-only change — the type enum keeps both stored
    // values so no project_type rebuild / data migration is needed.
    expect(schemaSrc).toContain('"Terrain Piece"');
    expect(schemaSrc).toContain('"Diorama"');
  });

  test("VEHICLE is deliberately NOT a project type (Ross flagged it undecided)", () => {
    // Assert there is no Vehicle enum member / type-meta entry. A doc
    // comment may mention VEHICLE to record the decision — that's fine;
    // what matters is it's not a real, creatable type.
    expect(schemaSrc).not.toContain('"Vehicle"');
    expect(formSrc).not.toContain('type: "Vehicle"');
    expect(formSrc).not.toContain('value="Vehicle"');
  });
});

describe("MODEL project type — single-model sub-projects (2026-06-05)", () => {
  const formSrc = read("src/components/NewProjectForm.tsx");
  const schemaSrc = read("src/db/schema.ts");
  const actionSrc = read("src/lib/actions/projects.ts");

  test('"Model" is a member of the projectTypes enum', () => {
    expect(schemaSrc).toContain('"Model"');
  });

  test("the new-project picker offers a creatable Model option that can nest", () => {
    expect(formSrc).toContain('type: "Model"');
    // Model can sit under an Army / Warband / Unit.
    expect(formSrc).toMatch(/type: "Model",[\s\S]{0,200}acceptsParent: true/);
    // Not marked selectable: false — it shows in the picker.
    expect(formSrc).not.toMatch(/type: "Model",[\s\S]{0,200}selectable: false/);
  });

  test("createProject accepts a Model as a sub-project type", () => {
    expect(actionSrc).toContain('type !== "Unit" && type !== "Model"');
    expect(actionSrc).toContain("Sub-projects must be a Unit or a Model.");
  });

  test("MODEL needs no migration — it's an application-level enum member", () => {
    // The type column is a Drizzle enum with no DB CHECK constraint, so
    // adding "Model" is purely application-level. Sanity: there is no new
    // migration that touches a project_type check or rebuilds the table
    // for this value. (Asserted by the doc comment + the absence of a
    // type CHECK in the schema — the only project CHECK is the cascade.)
    expect(schemaSrc).toContain("project_stage_cascade");
    expect(schemaSrc).not.toContain('check("project_type');
  });
});
