import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M7 — Imports
 *
 * Covers the Phase 7 ship criterion: paste a plain-text army list,
 * see the parser populate a preview tree, apply, land on the new
 * Army workspace with the first units rendered.
 *
 * The full parser layer is exercised at the unit level (text /
 * BattleScribe / PDF / LLM-fallback); this test only verifies the
 * UI plumbing end-to-end.
 */

const SAMPLE_LIST = `## QA Strike Force
Faction: Adeptus Astartes
Points Limit: 2000

Captain in Terminator Armour - 105pts
10x Intercessors - 200pts
5x Terminators - 185pts
Redemptor Dreadnought - 210pts
`;

test.describe("M7 — Imports", () => {
  test("M7.1 paste a text list → preview → apply → land on Army workspace", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("import"));

    // Land on the import page from the projects index.
    await page.goto("/projects/import");
    await expect(
      page.getByRole("heading", { name: /IMPORT ARMY LIST/i }),
    ).toBeVisible();

    // Switch to paste mode and feed in the list.
    await page.getByRole("tab", { name: /Paste text/i }).click();
    await page
      .getByLabel(/Paste your list/i)
      .fill(SAMPLE_LIST);
    await page.getByRole("button", { name: /Parse list/i }).click();

    // Land on the preview screen.
    await expect(page).toHaveURL(
      /\/projects\/import\/[a-zA-Z0-9_-]{16}\/preview$/,
    );
    await expect(
      page.getByRole("heading", { name: /^┌─ PREVIEW ─$/ }),
    ).toBeVisible();

    // Army header pre-populated.
    const armyNameInput = page.locator('input[value="QA Strike Force"]').first();
    await expect(armyNameInput).toBeVisible();

    // At least the four unit names rendered in the editable form.
    for (const name of [
      "Captain in Terminator Armour",
      "Intercessors",
      "Terminators",
      "Redemptor Dreadnought",
    ]) {
      await expect(page.locator(`input[value="${name}"]`).first()).toBeVisible();
    }

    // Apply → land on the new Army workspace.
    await page
      .getByRole("button", { name: /Apply.*create projects/i })
      .click();

    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9_-]{16}$/, {
      timeout: 10_000,
    });
    await expect(
      page.getByRole("heading", { level: 1, name: /QA STRIKE FORCE/i }),
    ).toBeVisible();
  });
});
