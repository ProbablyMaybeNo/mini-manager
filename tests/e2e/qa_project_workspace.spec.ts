import { expect, test, type Page } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M3 — Project workspace lifecycle (v2 HEX.CODE dashboard).
 *
 * "+ New project" (the roster header icon) now creates a draft Army
 * immediately (name "New Project", 0 models — no mini-form) and opens its
 * editable INSPECTOR panel (`DashboardClient.handleAddProject` →
 * `ProjectPanelStack` → `ProjectWorkspaceBody`'s DETAILS section), where the
 * "Name" field renames it — this is a deliberate redesign choice (Ross), not
 * a regression: the old separate create-form step was redundant with the
 * page/panel content once the project exists (see MISSIONS.md bug B6).
 *
 * A row's body click opens the full editable INSPECTOR (ProjectPanelStack →
 * ProjectWorkspaceBody) — one panel with name, type, status, priority,
 * sub-projects, recipes, and (for a leaf) the model-count + painting-stage
 * grid. The standalone Army/Unit flow overlay was folded into this one panel.
 * This mission drives that path end to end: create → click row → full editor →
 * make it a leaf → set the model count → tick a painting stage → assert it
 * survives a reload (setCounter + updateProjectCount round-trip).
 */

async function addProject(page: Page, name: string): Promise<void> {
  const addBtn = page.getByRole("button", { name: "New project", exact: true });
  const nameField = page.getByLabel("Name", { exact: true });
  // Retry the open until the inspector panel mounts (guards a pre-hydration
  // click under parallel dev-server load — a stray untouched "New Project"
  // draft from a swallowed first click is harmless, since every assertion
  // downstream targets rows by their renamed title).
  await expect(async () => {
    await addBtn.click();
    await expect(nameField).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await nameField.fill(name);
  await nameField.blur();
  // The rename commits via updateProjectName on blur; the roster row + the
  // inspector's own header pick up the new title once it round-trips.
  await expect(
    page.getByRole("button", { name: `Open ${name}` }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Close project inspector" }).click();
}

test.describe("M3 — Project workspace lifecycle", () => {
  test("M3.1 create → click row opens full inspector → model count + stage bump persists", async ({
    page,
  }) => {
    // More steps than most (create → inspect → edit type → count + stage →
    // reload). The default 30s test timeout is too tight when the dev server is
    // under parallel load compiling each route for the first time.
    test.setTimeout(60_000);
    await signInAs(page, freshTestEmail());

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const name = `QA Squad ${Date.now()}`;
    await addProject(page, name);

    // R4-8 — the roster row is a `row` again, and the project title inside its
    // Title cell is the control that opens it. The row still opens on a body
    // click for a mouse; this is the keyboard/AT path.
    const openTitle = page.getByRole("button", { name: `Open ${name}` });
    await expect(openTitle).toBeVisible({ timeout: 15_000 });

    // Opens the full editable INSPECTOR (not the old flow overlay): name,
    // type, status, priority all editable in one panel.
    await openTitle.click();
    const inspector = page.locator('section[aria-label="Project inspector"]');
    await expect(inspector).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name, {
      timeout: 15_000,
    });
    await expect(page.getByRole("combobox", { name: "Project type" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Project status" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Project priority" })).toBeVisible();

    // Make it a leaf (MODEL) so PROGRESS renders the model-count + painting-stage
    // grid (folded in from the old unit flow panel).
    await page.getByRole("combobox", { name: "Project type" }).click();
    await page.getByRole("option", { name: "MODEL" }).click();

    // Set the model count to 1, then tick the first painting stage (Built). The
    // stage steppers clamp to the model count, so Models must be raised first.
    await page.getByRole("button", { name: "Increase model count" }).click();
    await expect(page.getByText(/^0\s*\/\s*1$/).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Increase Built" }).click();
    await expect(page.getByText(/^1\s*\/\s*1$/)).toBeVisible({ timeout: 15_000 });

    // Persistence: reload, reopen the row, and confirm the stage bump survived
    // the server round-trip (setCounter + updateProjectCount committed). Retrying
    // the reload is more robust than waitForResponse under dev-server load.
    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: `Open ${name}` }).click();
      await expect(page.getByText(/^1\s*\/\s*1$/)).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 45_000 });
  });

  test("M3.2 leaf rows render no expand chevron; the tree expands containers", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("tree"));

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // A standalone project (no children) is a leaf — it gets NO expand
    // chevron. The create panel doesn't expose a parent picker, so the
    // nested-tree expand path is covered by the import mission (which
    // creates an Army with child Units). Here we assert the leaf contract.
    const name = `QA Leaf ${Date.now()}`;
    await addProject(page, name);

    await expect(
      page.getByRole("button", { name: `Open ${name}` }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: new RegExp(`(Expand|Collapse) ${name}`) }),
    ).toHaveCount(0);
  });
});
