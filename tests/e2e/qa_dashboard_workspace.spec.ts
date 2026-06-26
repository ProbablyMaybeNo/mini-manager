import { expect, test, type Page } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M11 — Dashboard real-data features (post mock-data wiring).
 *
 * The dashboard now renders the signed-in user's real data and exposes two
 * new flows:
 *   - PLANNER "+ Date" → create a calendar event → it shows in the ticker.
 *   - Project workspace inspector → add a sub-project + bump its completed
 *     stepper (army progress rolls up from finished models).
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

  test("M11.2 add a sub-project in the inspector + bump its completed stepper", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("workspace"));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const army = `QA Army ${Date.now()}`;
    await addProject(page, army, 0); // default type = Army (hosts Units)

    await page.getByRole("button", { name: `Manage ${army}` }).click();
    const inspector = page.getByRole("dialog", { name: army });
    await expect(inspector).toBeVisible();

    // Add a sub-project (Unit, 5 models).
    const addSub = inspector.getByRole("button", { name: /^\+ Sub-project$/ });
    const subName = inspector.getByLabel(/sub-project name/i);
    await expect(async () => {
      await addSub.click();
      await expect(subName).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await subName.fill("Intercessor Squad");
    await inspector.getByLabel(/sub-project model count/i).fill("5");
    await inspector.getByRole("button", { name: /^Add$/ }).click();

    // The sub-project appears in the sub-projects table, starting at 0/5.
    await expect(inspector.getByText("Intercessor Squad")).toBeVisible({
      timeout: 30_000,
    });
    await expect(inspector.getByText("0/5")).toBeVisible({ timeout: 15_000 });

    // Bump its completed stepper → 1/5 (army progress rolls up from this).
    await inspector
      .getByRole("button", { name: /increase completed for Intercessor Squad/i })
      .click();
    await expect(inspector.getByText("1/5")).toBeVisible({ timeout: 15_000 });
  });
});
