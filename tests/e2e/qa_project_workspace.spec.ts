import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M3 — Project workspace lifecycle (reworked dashboard).
 *
 * The dashboard reworked projects into a tree. Creating a project no
 * longer navigates anywhere — "+ Add Project" opens NewProjectPanel,
 * persists via createProject, then refreshes the dashboard table.
 *
 * Each row exposes:
 *   - a body click → opens the read-only ProjectInspector (a dialog),
 *   - a focus icon (aria-label "Open <title> in focus") → /focus?project=<id>,
 *   - an expand chevron (only when the row has sub-projects).
 *
 * The model-completion stepper now lives on the FOCUS bench (not the
 * inspector), so this mission creates a project, opens the inspector to
 * confirm the slide-out, then drives the focus bench's "Increase models
 * painted" stepper and asserts the bump persists across reload.
 */

async function addProject(
  page: import("@playwright/test").Page,
  name: string,
  count: number,
): Promise<void> {
  const addBtn = page.getByRole("button", { name: /\+ Add Project/i });
  const panel = page.getByRole("dialog", { name: /New Project/i });
  // Retry until the slide-out mounts (guards a pre-hydration click).
  await expect(async () => {
    await addBtn.click();
    await expect(panel).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await panel.getByLabel(/project name/i).fill(name);
  await panel.getByLabel(/model count/i).fill(String(count));
  await panel.getByRole("button", { name: /create project/i }).click();
  // Panel closes + the dashboard refreshes; the new row appears.
  await expect(panel).toBeHidden({ timeout: 15_000 });
}

test.describe("M3 — Project workspace lifecycle", () => {
  test("M3.1 create → inspector opens → focus stepper bump persists", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const name = `QA Squad ${Date.now()}`;
    await addProject(page, name, 5);

    // The new project row is rendered in the PROJECTS tree.
    const row = page.getByRole("button", { name: `Manage ${name}` });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Clicking the row body opens the project workspace inspector (a dialog
    // labelled with the project title).
    await row.click();
    const inspector = page.getByRole("dialog", { name });
    await expect(inspector).toBeVisible();
    await expect(inspector.getByRole("button", { name: /▸ Focus/i })).toBeVisible();
    // The panel closes via its ✕ (aria-label "Close panel").
    await inspector.getByRole("button", { name: /close panel/i }).click();
    await expect(inspector).toBeHidden();

    // The per-row focus icon navigates to the focus bench for this project.
    await page
      .getByRole("button", { name: `Open ${name} in focus` })
      .click();
    await page.waitForURL(/\/focus\?project=/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /^FOCUS$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // Bump the model-completion stepper. Starts at 0/5.
    await expect(page.getByText(/^0\s*\/\s*5$/)).toBeVisible({ timeout: 15_000 });
    // The stepper persists via a fire-and-forget server action (no UI
    // confirmation), so wait for the action POST to settle before reloading.
    const actionDone = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/focus"),
      { timeout: 30_000 },
    );
    await page
      .getByRole("button", { name: /increase models painted/i })
      .click();
    await expect(page.getByText(/^1\s*\/\s*5$/)).toBeVisible();
    await actionDone;

    // Reload the focus bench (same project) — the stepper persists.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(/^1\s*\/\s*5$/)).toBeVisible({ timeout: 30_000 });
  });

  test("M3.2 leaf rows render no expand chevron; the tree expands containers", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("tree"));

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // A standalone project (no children) is a leaf — it gets NO expand
    // chevron. The create panel doesn't expose a parent picker, so the
    // nested-tree expand path is covered by the import mission (which
    // creates an Army with child Units). Here we assert the leaf contract.
    const name = `QA Leaf ${Date.now()}`;
    await addProject(page, name, 2);

    await expect(
      page.getByRole("button", { name: `Manage ${name}` }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: new RegExp(`(Expand|Collapse) ${name}`) }),
    ).toHaveCount(0);
  });
});
