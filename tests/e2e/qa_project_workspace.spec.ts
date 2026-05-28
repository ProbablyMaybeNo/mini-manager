import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M3 — Project create + stage counter
 *
 * Covers the spine of Phase 1: create a Unit project, land in its
 * workspace, bump a stage counter, verify persistence across reload.
 * The full counter-cascade rules are tested at the unit + integration
 * layers — here we exercise the UI wiring.
 */

test.describe("M3 — Project workspace lifecycle", () => {
  test("M3.1 create Unit → bump Build → persists", async ({ page }) => {
    await signInAs(page, freshTestEmail());

    await page.goto("/projects/new");
    await expect(
      page.getByRole("heading", { name: /NEW PROJECT/i }),
    ).toBeVisible();

    // Type=Unit is the default; just fill the name + count.
    const unique = `QA Squad ${Date.now()}`;
    await page.getByPlaceholder(/Tactical Squad Alpha/).fill(unique);
    await page.locator('input[type="number"]').first().fill("5");

    await page.getByRole("button", { name: /create project/i }).click();

    // Lands on /projects/[id].
    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9_-]{16}$/);
    // Workspace H1 uppercases the project name and wraps it in box chars.
    await expect(
      page.getByRole("heading", { level: 1, name: new RegExp(unique, "i") }),
    ).toBeVisible();

    // Owned must be incremented first (cascade: build ≤ owned).
    await page.getByRole("button", { name: /Increment Owned/i }).click();
    await page.getByRole("button", { name: /Increment Build/i }).click();

    // Refresh and confirm the bump persisted.
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: new RegExp(unique, "i") }),
    ).toBeVisible();
    // The Build counter should now read 1/5 — the row containing the value.
    await expect(page.getByText(/^1\s*\/\s*5$/).first()).toBeVisible();
  });
});
