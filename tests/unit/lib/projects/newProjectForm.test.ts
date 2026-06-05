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
