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
 * A row's body click no longer navigates anywhere — it opens the Army/Unit
 * FLOW panel (`ProjectFlowPanel`, a 440px overlay) instead (Phase 2
 * HEX.CODE). That panel's "⤢ Open full page" affordance is what routes to
 * the full project PAGE (/projects/<id>). There's also no UI path left to
 * set an arbitrary top-level model count at creation time — an Army's model
 * total now rolls up from its Units (each created with a fixed 1 model via
 * "+ Add unit"), so this mission adds a Unit to get a real, non-zero count to
 * drive the FOCUS bench's stepper against.
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
    page.getByRole("button", { name: `Manage ${name}` }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Close project inspector" }).click();
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
    await addProject(page, name);

    // The new project row is rendered in the PROJECTS tree.
    const row = page.getByRole("button", { name: `Manage ${name}` });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Phase 2 HEX.CODE: the row body no longer navigates — it opens the
    // Army/Unit FLOW panel as an overlay dialog (labelled with whichever
    // project/unit is currently active in its drill stack, so the locator
    // stays name-agnostic — only one flow panel is ever open at a time).
    await row.click();
    const flowPanel = page.getByRole("dialog");
    await expect(flowPanel).toBeVisible({ timeout: 15_000 });
    await expect(flowPanel.getByRole("heading", { name, level: 2 })).toBeVisible({
      timeout: 15_000,
    });

    // The panel's "⤢ Open full page" affordance is the actual route to the
    // full project PAGE (/projects/<id>), which leads with the project name
    // as its h1 and a "Back to dashboard" breadcrumb control.
    await flowPanel.getByRole("button", { name: /open full page/i }).click();
    await page.waitForURL(/\/projects\//, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name, level: 1 }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // A fresh Army's rolled-up model count is 0 (no UI sets an arbitrary count
    // at creation anymore — see the module doc comment), so "+ Add unit" is
    // the only way to a real, non-zero total: it creates a Unit with a fixed 1
    // model and drills the SAME flow panel straight into its workbench.
    await row.click();
    await expect(flowPanel).toBeVisible({ timeout: 15_000 });
    await flowPanel.getByRole("button", { name: /^\+ Add unit$/ }).click();
    await expect(
      flowPanel.getByRole("heading", { name: "New Unit", level: 2 }),
    ).toBeVisible({ timeout: 15_000 });

    // "▷ GO PAINT!" on the Unit workbench is this mission's route to the FOCUS
    // bench (closes the panel, navigates to /focus?project=<unitId>).
    await flowPanel.getByRole("button", { name: /go paint/i }).click();
    await page.waitForURL(/\/focus\?project=/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /^FOCUS$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // Bump the model-completion stepper. Starts at 0/1 (the Unit's fixed count).
    await expect(page.getByText(/^0\s*\/\s*1$/)).toBeVisible({ timeout: 15_000 });
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
    await expect(page.getByText(/^1\s*\/\s*1$/)).toBeVisible({ timeout: 15_000 });

    // Confirm persistence: keep reloading until the server-side state shows
    // 1/1 (the server action has committed). Retrying the reload is more
    // robust than waitForResponse under dev-server load (MM-test-1).
    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(/^1\s*\/\s*1$/)).toBeVisible({ timeout: 5_000 });
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
    await addProject(page, name);

    await expect(
      page.getByRole("button", { name: `Manage ${name}` }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: new RegExp(`(Expand|Collapse) ${name}`) }),
    ).toHaveCount(0);
  });
});
