import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M7 — Imports (Upload Army List).
 *
 * The retired /projects/import route is gone; importing now happens via
 * the dashboard's "⬆ Upload Army List" slide-out (ArmyImportPanel). The
 * real two-step importer runs server-side:
 *   paste a list → "Parse list" (createTextImport + preview) →
 *   "Import N units" (applyImport → Army container + a child Unit per
 *   parsed entry) → panel closes + dashboard refreshes.
 *
 * The heuristic text parser handles a plain unit list with no LLM/API
 * key needed, so the flow is fully E2E-testable. After import we assert
 * the Army row appears and its expand chevron reveals the child units —
 * which also exercises the reworked dashboard tree.
 */

const SAMPLE_LIST = `10x Intercessors
5x Terminators
1x Captain
3x Eradicators`;

test.describe("M7 — Imports", () => {
  test("M7.1 paste a text list → parse → import → Army tree on dashboard", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("import"));

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // The dashboard's trigger button reads "⬆ Upload Army" (no "List" suffix)
    // — the slide-out panel it opens keeps the fuller "Upload Army List" title.
    const uploadBtn = page.getByRole("button", { name: /Upload Army/i });
    const panel = page.getByRole("dialog", { name: /Upload Army List/i });
    // Retry until the slide-out mounts (guards a pre-hydration click).
    await expect(async () => {
      await uploadBtn.click();
      await expect(panel).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    await panel.locator("textarea").fill(SAMPLE_LIST);
    await panel.getByRole("button", { name: /Parse list/i }).click();

    // Preview state: the parsed units render in the panel.
    await expect(panel.getByText(/Intercessors/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(panel.getByText(/Terminators/i)).toBeVisible();

    // Apply — the Import button label carries the parsed unit count.
    await panel.getByRole("button", { name: /^Import \d+ units?$/i }).click();
    await expect(panel).toBeHidden({ timeout: 30_000 });

    // The new Army container shows up in the PROJECTS tree as a top-level
    // row with an expand chevron (it has child Units).
    const expand = page
      .getByRole("button", { name: /Expand .+/ })
      .first();
    await expect(expand).toBeVisible({ timeout: 15_000 });
    await expand.click();

    // Expanding reveals the imported units inline.
    await expect(
      page.getByRole("button", { name: /Manage .*Intercessors/i }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
