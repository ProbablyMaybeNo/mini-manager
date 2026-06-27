import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M3 — Project workspace lifecycle (reworked dashboard).
 *
 * The dashboard reworked projects into a tree. Creating a project no
 * longer navigates anywhere — "+ New Project" opens the project page in
 * CREATE mode (RF-8); SAVE ("Create") persists via createProject, then the
 * new row appears and its edit panel opens.
 *
 * Each row exposes:
 *   - a body click → navigates to the project PAGE (/projects/<id>) (PP-1),
 *   - a focus icon (aria-label "Open <title> in focus") → /focus?project=<id>,
 *   - an expand chevron (only when the row has sub-projects).
 *
 * The model-completion stepper now lives on the FOCUS bench (not the
 * project page), so this mission creates a project, opens its page to confirm
 * the navigation, then drives the focus bench's "Increase models painted"
 * stepper and asserts the bump persists across reload.
 */

async function addProject(
  page: import("@playwright/test").Page,
  name: string,
  count: number,
): Promise<void> {
  // RF-8: "+ New Project" opens the project page in CREATE mode (not the old
  // mini-form dialog). Fill Name + Model count, then SAVE (labelled "Create").
  const addBtn = page.getByRole("button", { name: /\+ New Project/i });
  const nameField = page.getByLabel("Name", { exact: true });
  await expect(async () => {
    await addBtn.click();
    await expect(nameField).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await nameField.fill(name);
  await page.getByLabel(/model count/i).fill(String(count));
  await page.getByRole("button", { name: /^▾?\s*Create$/i }).click();
  // Create mode transitions to the new project's edit panel; the new row
  // appears in the table.
  await expect(
    page.getByRole("button", { name: `Manage ${name}` }),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("M3 — Project workspace lifecycle", () => {
  test("M3.1 create → project page opens → focus stepper bump persists", async ({
    page,
  }) => {
    // This test has more steps than most (create → inspect → focus → stepper →
    // reload). The default 30s test timeout is too tight when the dev server is
    // under parallel load compiling each route for the first time.
    test.setTimeout(60_000);
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

    // PP-1: clicking the row body navigates to the dedicated project PAGE
    // (/projects/<id>) — no slide-out inspector. The page leads with the
    // project name as its h1, then a back control returns to the dashboard.
    await row.click();
    await page.waitForURL(/\/projects\//, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name, level: 1 }),
    ).toBeVisible({ timeout: 30_000 });
    // The back control returns to the dashboard.
    await page.getByRole("button", { name: /‹ Dashboard/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });

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
    // The stepper uses optimistic local state (React useState) so the UI
    // updates immediately on click. The server action (setProjectComplete) runs
    // in a startTransition and posts to /focus?project=<id> via Next-Action.
    // Under parallel dev-server load the POST can take tens of seconds to
    // respond, making waitForResponse unreliable. Instead we click, confirm the
    // optimistic UI update, then poll reloads until the server state matches —
    // this naturally waits for the server action to commit without a fixed timeout.
    await page
      .getByRole("button", { name: /increase models painted/i })
      .click();
    await expect(page.getByText(/^1\s*\/\s*5$/)).toBeVisible({ timeout: 15_000 });

    // Confirm persistence: keep reloading until the server-side state shows
    // 1/5 (the server action has committed). Retrying the reload is more
    // robust than waitForResponse under dev-server load (MM-test-1).
    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(/^1\s*\/\s*5$/)).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 45_000 });
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
