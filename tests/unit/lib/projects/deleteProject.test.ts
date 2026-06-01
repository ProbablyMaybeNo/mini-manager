/**
 * P13.3 — Delete project surface coverage.
 *
 * Pins the contract for the modal + trigger + mount points so future
 * refactors can't quietly drop the destructive surface. The cascade-
 * delete behaviour itself lives in the integration tests for the
 * server action (tests/integration/actions/projects.test.ts).
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

describe("DeleteProjectModal component surface", () => {
  const src = read("src/components/projects/DeleteProjectModal.tsx");

  test("fetches the descendant count on open + renders it in the prompt", () => {
    expect(src).toContain("countProjectDescendants");
    expect(src).toMatch(/and \$\{descendantCount\} sub-project/);
  });

  test("destructive confirm uses the P13.1 danger button variant", () => {
    expect(src).toContain('variant="danger"');
    expect(src).toMatch(/Delete forever/);
  });

  test("calls the server action on confirm + routes per caller intent", () => {
    expect(src).toContain("deleteProject");
    expect(src).toContain("redirectToProjectsOnSuccess");
    expect(src).toContain('router.push("/projects")');
    expect(src).toContain("router.refresh()");
  });

  test("warns that attached recipes survive (no orphaning user data)", () => {
    expect(src).toMatch(/Attached recipes\s+stay in your library/);
  });

  test("disables the cancel + confirm buttons while the action runs", () => {
    expect(src).toMatch(/disabled=\{isPending\}/);
  });
});

describe("DeleteProjectButton trigger", () => {
  const src = read("src/components/projects/DeleteProjectButton.tsx");

  test("exposes both inline + filled variants", () => {
    expect(src).toContain("inline?: boolean");
    expect(src).toContain('variant="danger"');
  });

  test("opens DeleteProjectModal with the props forwarded", () => {
    expect(src).toContain("DeleteProjectModal");
    expect(src).toContain("redirectToProjectsOnSuccess={redirectToProjectsOnSuccess}");
  });
});

describe("Project detail page mounts the delete trigger", () => {
  const src = read("src/app/projects/[id]/page.tsx");

  test("imports DeleteProjectButton", () => {
    expect(src).toContain("DeleteProjectButton");
  });

  test("renders the inline trigger on the breadcrumb row with redirect-to-projects on success", () => {
    expect(src).toMatch(/DeleteProjectButton[\s\S]*?redirectToProjectsOnSuccess/);
    expect(src).toMatch(/DeleteProjectButton[\s\S]*?inline/);
  });
});

describe("Projects dashboard table mounts the delete trigger per row", () => {
  const src = read("src/components/ProjectsDashboardTable.tsx");

  test("imports DeleteProjectButton", () => {
    expect(src).toContain("DeleteProjectButton");
  });

  test("renders the inline trigger in the row's actions cell, NOT redirecting", () => {
    expect(src).toMatch(/redirectToProjectsOnSuccess=\{false\}/);
    expect(src).toMatch(/label="Delete"/);
  });
});

describe("deleteProject server action surface", () => {
  const src = read("src/lib/actions/projects.ts");

  test("exports deleteProject + countProjectDescendants", () => {
    expect(src).toContain("export async function deleteProject");
    expect(src).toContain("export async function countProjectDescendants");
  });

  test("scopes by owner before deletion", () => {
    // The lookup before the delete asserts ownership.
    expect(src).toMatch(
      /deleteProject[\s\S]*?eq\(projects\.ownerId,\s*userId\)/,
    );
  });

  test("revalidates /projects + parent path", () => {
    expect(src).toMatch(
      /deleteProject[\s\S]*?revalidatePath\("\/projects"\)/,
    );
    expect(src).toMatch(
      /deleteProject[\s\S]*?revalidatePath\(`\/projects\/\$\{parentId\}`\)/,
    );
  });
});
