import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M3 — Project create + inspector (FIGMA-REBUILD).
 *
 * Project detail is a slide-out inspector on /projects (`?project=<id>`),
 * not a standalone /projects/[id] page. This mission verifies create →
 * inspector opens → completion counter bumps → persists across reload.
 */

test.describe("M3 — Project workspace lifecycle", () => {
  test("M3.1 create Unit → bump completion in inspector → persists", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());

    await page.goto("/projects/new");
    await expect(
      page.getByRole("heading", { name: /NEW PROJECT/i }),
    ).toBeVisible();

    const unique = `QA Squad ${Date.now()}`;
    await page.getByPlaceholder(/Tactical Squad Alpha/).fill(unique);
    await page.locator('input[type="number"]').first().fill("5");

    await page.getByRole("button", { name: /create project/i }).click();

    await expect(page).toHaveURL(/\/projects\?project=[a-zA-Z0-9_-]+/);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(unique, { exact: false })).toBeVisible();

    await dialog.getByRole("button", { name: /increase completed models/i }).click();
    await expect(dialog.getByText(/^1\s*\/\s*5$/)).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/projects\?project=/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/^1\s*\/\s*5$/).first()).toBeVisible();
  });
});
