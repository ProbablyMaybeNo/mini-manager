import { expect, test, type Page } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M11 — Dashboard real-data features (post mock-data wiring, v2 HEX.CODE).
 *
 * The dashboard now renders the signed-in user's real data and exposes two
 * new flows:
 *   - PLANNER "+ Date" → create a calendar event → it shows in the ticker.
 *   - Project PAGE (PP-2) "+ ADD UNIT" / "+ Add Sub-Project" → hands off to
 *     `/dashboard?open=<id>`, which reopens that project's editable INSPECTOR
 *     panel (same panel the create flow opens) scrolled to SUB-PROJECTS; its
 *     "+ Sub-project" picker adds a Unit, which drills the SAME panel into the
 *     new sub-project's own tab. Flipping back to the parent's tab shows the
 *     PROGRESS table's per-row stepper, which bumps the child's completed
 *     count (army progress rolls up — see MISSIONS.md commit f012be2).
 *
 * "+ New project" creates a draft Army immediately (no name/model-count
 * mini-form) and opens that same INSPECTOR panel to rename it — a deliberate
 * v2 redesign choice (Ross), not a regression (MISSIONS.md bug B6). A row's
 * body click opens a *different* overlay (the Army/Unit FLOW panel) rather
 * than navigating; reaching the full project PAGE goes through that panel's
 * "⤢ Open full page" affordance.
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
  await expect(
    page.getByRole("button", { name: `Manage ${name}` }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Close project inspector" }).click();
}

/** Open the project PAGE for a dashboard row. A row's body click opens the full
 *  editable INSPECTOR (a "Project inspector" region), whose "⤢ Open full page"
 *  affordance routes to the roomy /projects/<id> page. */
async function openProjectPage(page: Page, name: string): Promise<string> {
  await page.getByRole("button", { name: `Manage ${name}` }).click();
  const inspector = page.getByRole("region", { name: "Project inspector" });
  await expect(inspector).toBeVisible({ timeout: 15_000 });
  await inspector.getByRole("button", { name: /open full page/i }).click();
  await page.waitForURL(/\/projects\//, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name, level: 1 }),
  ).toBeVisible({ timeout: 30_000 });
  return page.url();
}

test.describe("M11 — Dashboard real-data features", () => {
  test("M11.1 add a calendar event via a day cell → shows in the rail's UPCOMING list", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("planner"));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // There's no standalone "+ Date" button anymore (MM-47) — clicking a day
    // cell on the right rail's mini calendar grid opens the add-event form
    // prefilled with that day. The 15th always exists, so no month-nav needed;
    // the exact date gets overwritten by the Date field fill below anyway.
    const planner = page.getByRole("complementary", { name: "Planner" });
    const dayCell = planner.getByRole("button", { name: /\b15\b/ });
    const nameField = page.locator('input[name="event-name"]');
    // Retry the open until the form mounts (guards a pre-hydration click).
    await expect(async () => {
      await dayCell.click();
      await expect(nameField).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    const eventName = `QA Tournament ${Date.now()}`;
    await nameField.fill(eventName);
    await page.locator('input[name="event-date"]').fill("2026-12-25");
    // Event kind defaults to "tournament" (now a kit Listbox, not a <select>),
    // which is what this test asserts — leave the dropdown closed so its popup
    // doesn't overlap the Add button below it.
    await page.getByRole("button", { name: /^Add$/ }).click();

    // The new event renders in the right rail's UPCOMING list. The mobile
    // bottom-ticker button (xl:hidden) also carries the event text in the
    // DOM even though it's visually hidden on this desktop viewport, so
    // scope the assertion to the rail for a unique match.
    await expect(planner.getByText(eventName)).toBeVisible({ timeout: 30_000 });
  });

  test("M11.2 add a sub-project on the project page + bump its completed stepper", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await signInAs(page, freshTestEmail("workspace"));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const army = `QA Army ${Date.now()}`;
    await addProject(page, army); // default type = Army (hosts Units)
    const projectUrl = await openProjectPage(page, army);
    const projectId = projectUrl.split("/projects/")[1].split(/[?#]/)[0];

    // PP-2: "+ ADD UNIT" hands off to /dashboard?open=<id>, which reopens the
    // editable INSPECTOR panel for this project (no type picker lives on the
    // page itself). The SUB-PROJECTS section is expanded by default.
    await page.getByRole("button", { name: /^\+ ADD UNIT$/ }).click();
    await page.waitForURL(new RegExp(`/dashboard\\?open=${projectId}`), {
      timeout: 30_000,
    });

    // An Army can host Unit / Warband / Model / Terrain, so "+ Sub-project"
    // shows a type picker — pick Unit. Creating it drills the SAME panel
    // straight into the new sub-project's own tab (a "New Unit").
    const inspector = page.getByRole("region", { name: "Project inspector" });
    await expect(
      inspector.getByRole("heading", { name: army, level: 2 }),
    ).toBeVisible({ timeout: 30_000 });
    await inspector.getByRole("button", { name: /^\+ Sub-project$/ }).click();
    await inspector.getByRole("button", { name: /^Unit$/ }).click();
    await expect(
      inspector.getByRole("heading", { name: "New Unit", level: 2 }),
    ).toBeVisible({ timeout: 30_000 });

    // Flip back to the army's own tab — the new Unit shows in its
    // SUB-PROJECTS list and PROGRESS table, starting at 0/1 (its fixed
    // single-model count). ("New Unit" itself renders 3x in this tab — the
    // SUB-PROJECTS row, the PROGRESS row, and the tab label — so the
    // deterministic signal is the PROGRESS row's own stepper button.)
    await inspector.getByRole("tab", { name: army }).click();
    const increaseBtn = inspector.getByRole("button", {
      name: /increase completed for New Unit/i,
    });
    await expect(increaseBtn).toBeVisible({ timeout: 15_000 });

    // Bump the new Unit's completed stepper → 1/1 (army progress rolls up,
    // commit f012be2 — "watch the army fill in green").
    await increaseBtn.click();
    await expect(inspector.getByText("1/1")).toBeVisible({ timeout: 15_000 });
  });
});
