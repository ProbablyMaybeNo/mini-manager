/**
 * R7-008 — project title is inline-editable.
 *
 * The auditor flagged that the recipe editor's <h1> is contentEditable
 * (the painter can rename a recipe in place) but the project detail
 * page's <h1> was plain text. R7-008 replicates the contentEditable
 * pattern via a new EditableProjectTitle client component + a new
 * updateProjectName server action.
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

describe("EditableProjectTitle — R7-008 inline-rename client component", () => {
  const src = read("src/components/EditableProjectTitle.tsx");

  test("is a `'use client'` module", () => {
    expect(src.startsWith('"use client"')).toBe(true);
  });

  test("renders <h1> with contentEditable + role='textbox'", () => {
    expect(src).toContain("<h1");
    expect(src).toContain("contentEditable");
    expect(src).toContain('role="textbox"');
    expect(src).toContain('aria-label="Project name"');
  });

  test("calls updateProjectName from the projects actions module", () => {
    expect(src).toContain(
      'import { updateProjectName } from "@/lib/actions/projects";',
    );
    expect(src).toContain("updateProjectName({ id: projectId, name: trimmed })");
  });

  test("debounces saves at 600ms to match the recipe header", () => {
    expect(src).toContain("const NAME_DEBOUNCE_MS = 600;");
  });

  test("blank text on blur reverts to the last saved name (no orphan)", () => {
    expect(src).toContain("if (trimmed.length === 0)");
    expect(src).toContain("event.currentTarget.textContent = savedName;");
  });

  test("renders a 'saving…' status while the transition is in flight", () => {
    expect(src).toContain('role="status"');
    expect(src).toContain("saving…");
  });

  test("renders the cyan glow text-shadow matching the recipe header", () => {
    expect(src).toContain("var(--color-cyan)");
    expect(src).toContain("textShadow");
  });
});

describe("ProjectHeaderStrip — R7-008 swaps the static h1 for the editable one", () => {
  const src = read("src/components/ProjectHeaderStrip.tsx");

  test("imports EditableProjectTitle", () => {
    expect(src).toContain(
      'import { EditableProjectTitle } from "@/components/EditableProjectTitle";',
    );
  });

  test("renders <EditableProjectTitle projectId={...} name={name} />", () => {
    expect(src).toContain(
      "<EditableProjectTitle projectId={projectId} name={name} />",
    );
  });

  test("the static cyan <h1> block is gone", () => {
    // No bare <h1 className=…> with cyan colour token left.
    expect(src).not.toMatch(/<h1[\s\S]{0,40}className=.*color-cyan/);
  });
});

describe("updateProjectName — R7-008 server action", () => {
  const src = read("src/lib/actions/projects.ts");

  test("is exported with the right signature", () => {
    expect(src).toContain("export async function updateProjectName(");
    expect(src).toContain("ActionResult<{ id: string; name: string }>");
  });

  test("validates name with Zod (required, trimmed, max 120)", () => {
    expect(src).toContain(".min(1, \"Name is required\")");
    expect(src).toContain(".max(120, \"Name is too long\")");
    expect(src).toContain(".trim()");
  });

  test("checks ownership before writing", () => {
    // The action must verify ownerId before letting a hostile client
    // rename another user's project.
    const fnIdx = src.indexOf("export async function updateProjectName(");
    expect(fnIdx).toBeGreaterThan(0);
    const body = src.slice(fnIdx, fnIdx + 1200);
    expect(body).toContain("eq(projects.ownerId, userId)");
  });

  test("revalidates /projects + /projects/[id] + parent on rename", () => {
    const fnIdx = src.indexOf("export async function updateProjectName(");
    const body = src.slice(fnIdx, fnIdx + 1200);
    expect(body).toContain('revalidatePath("/projects")');
    expect(body).toContain("revalidatePath(`/projects/${id}`)");
    expect(body).toContain("revalidatePath(`/projects/${project.parentId}`)");
  });
});
