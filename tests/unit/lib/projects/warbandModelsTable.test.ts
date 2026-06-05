/**
 * batch/model-warband — Warband models table.
 *
 * On a Warband project page the recipe box at the top is replaced by a
 * "+ Model" CTA + a flat models table. Models are the existing Unit
 * sub-projects. Columns mirror the dashboard row format:
 *   Name (link) · Class (inline modelClass editor) · Recipe (+ ATTACH) ·
 *   Status (StatusPill / bumpProjectStatus) · Priority (InlineCellPopover)
 *   · Completion (ProgressBar) · Delete (DeleteProjectButton).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("WarbandModelsTable component surface", () => {
  const src = read("src/components/projects/WarbandModelsTable.tsx");

  test("locked column set: Name / Class / Recipe / Status / Priority / Completion", () => {
    expect(src).toContain(">Name</th>");
    expect(src).toContain(">Class</th>");
    expect(src).toContain(">Recipe</th>");
    expect(src).toContain(">Status</th>");
    expect(src).toContain(">Priority</th>");
    expect(src).toContain(">Completion</th>");
  });

  test("+ Model CTA deep-links to the existing parent Unit-creation flow", () => {
    expect(src).toContain("+ Model");
    expect(src).toContain("?parent=${warbandId}&type=Unit");
    // ADD/CREATE → success-green per the button discipline (no cyan).
    expect(src).toMatch(/variant="success"[\s\S]{0,80}\+ Model/);
  });

  test("Name cell links to the model's own project page", () => {
    expect(src).toContain("href={`/projects/${row.id}`}");
  });

  test("Class cell is an inline free-text editor writing modelClass", () => {
    expect(src).toContain("ModelClassCell");
    expect(src).toContain("setModelClass({");
    // length-capped to match the schema/action 40-char cap
    expect(src).toContain("maxLength={40}");
    // debounced save like EditableProjectTitle
    expect(src).toContain("CLASS_DEBOUNCE_MS");
  });

  test("Recipe cell reuses AttachRecipeModal in project mode", () => {
    expect(src).toContain("AttachRecipeModal");
    expect(src).toContain('mode="project"');
    expect(src).toContain("setAttachOpen(true)");
  });

  test("Status cell reuses StatusPill + bumpProjectStatus", () => {
    expect(src).toContain("StatusPill");
    expect(src).toContain("bumpProjectStatus({");
  });

  test("Priority cell reuses the InlineCellPopover pattern + updateProjectPriority", () => {
    expect(src).toContain("InlineCellPopover");
    expect(src).toContain("updateProjectPriority({");
  });

  test("Completion cell reuses ProgressBar", () => {
    expect(src).toContain("<ProgressBar");
    expect(src).toContain("percent={row.progressPercent}");
  });

  test("Delete reuses DeleteProjectButton (inline, stays on page)", () => {
    expect(src).toContain("DeleteProjectButton");
    expect(src).toContain("redirectToProjectsOnSuccess={false}");
  });

  test("does not rebuild status/priority/progress/attach/delete primitives", () => {
    // Reuse, don't re-implement — these primitives are imported, not
    // duplicated inline.
    expect(src).toContain('from "@/components/ui/StatusPill"');
    expect(src).toContain('from "@/components/ui/InlineCellPopover"');
    expect(src).toContain('from "@/components/ProgressBar"');
    expect(src).toContain('from "@/components/recipes/AttachRecipeModal"');
    expect(src).toContain('from "@/components/projects/DeleteProjectButton"');
  });

  test("renders an empty-state when the warband has no models", () => {
    expect(src).toContain("No models yet");
  });
});
