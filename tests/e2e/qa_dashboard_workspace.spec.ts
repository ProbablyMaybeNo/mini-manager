import { expect, test, type Page } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M11 — Dashboard real-data features (post mock-data wiring).
 *
 * The dashboard now renders the signed-in user's real data and exposes two
 * new flows:
 *   - PLANNER "+ Date" → create a calendar event → it shows in the ticker.
 *   - Project PAGE (PP-1/PP-2) → a row click navigates to /projects/<id>; the
 *     page's SUB-PROJECTS list adds a sub-project (which drills into it), and
 *     the PROGRESS stepper bumps its completed count (army progress rolls up).
 */

async function addProject(page: Page, name: string, count: number) {
  // RF-8: "+ New Project" opens the project page in CREATE mode; SAVE
  // ("Create") persists it and the new row appears in the table.
  const addBtn = page.getByRole("button", { name: /\+ New Project/i });
  const nameField = page.getByLabel("Name", { exact: true });
  await expect(async () => {
    await addBtn.click();
    await expect(nameField).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await nameField.fill(name);
  await page.getByLabel(/model count/i).fill(String(count));
  await page.getByRole("button", { name: /^▾?\s*Create$/i }).click();
  await expect(
    page.getByRole("button", { name: `Manage ${name}` }),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("M11 — Dashboard real-data features", () => {
  test("M11.1 add a calendar event via + Date → shows in the ticker", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("planner"));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const eventName = `QA Tournament ${Date.now()}`;
    const addDate = page.getByRole("button", { name: /^\+ Date$/ });
    const nameField = page.locator('input[name="event-name"]');
    // Retry the open until the form mounts (guards a pre-hydration click).
    await expect(async () => {
      await addDate.click();
      await expect(nameField).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    await nameField.fill(eventName);
    await page.locator('input[name="event-date"]').fill("2026-12-25");
    // Event kind defaults to "tournament" (now a kit Listbox, not a <select>),
    // which is what this test asserts — leave the dropdown closed so its popup
    // doesn't overlap the Add button below it.
    await page.getByRole("button", { name: /^Add$/ }).click();

    // The new event renders in the bottom "Upcoming events" ticker.
    await expect(page.getByText(eventName)).toBeVisible({ timeout: 30_000 });
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
    await addProject(page, army, 0); // default type = Army (hosts Units)

    // PP-1: the row click navigates to the army's project PAGE.
    await page.getByRole("button", { name: `Manage ${army}` }).click();
    await page.waitForURL(/\/projects\//, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: army, level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // PP-2: the SUB-PROJECTS list's "+ Sub-project" affordance. An Army can host
    // Unit / Warband / Model / Terrain, so a type picker appears — pick Unit.
    // Creating a sub-project drills straight into its own page (a "New Unit").
    await page.getByRole("button", { name: /^\+ Sub-project$/ }).click();
    await page.getByRole("button", { name: /^Unit$/ }).click();
    await page.waitForURL(/\/projects\//, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /New Unit/i, level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // Back to the army page — the new Unit shows in its SUB-PROJECTS list, and
    // its PROGRESS row starts at 0/1 (the seeded single model).
    await page.getByRole("button", { name: /‹ Dashboard/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await page.getByRole("button", { name: `Manage ${army}` }).click();
    await page.waitForURL(/\/projects\//, { timeout: 30_000 });
    await expect(page.getByText("New Unit")).toBeVisible({ timeout: 30_000 });

    // Bump the new Unit's completed stepper → 1/1 (army progress rolls up).
    await page
      .getByRole("button", { name: /increase completed for New Unit/i })
      .click();
    await expect(page.getByText("1/1")).toBeVisible({ timeout: 15_000 });
  });
});
