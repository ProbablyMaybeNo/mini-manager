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
 *     "+ Sub-project" form adds a Unit inline, and the new row carries its own
 *     progress bar. A container has no PROGRESS section at all (Ross,
 *     2026-08-01) — the sub-project rows are the progress readout.
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
    page.getByRole("button", { name: `Open ${name}` }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Close project inspector" }).click();
}

/** Open the project PAGE for a dashboard row. A row's body click opens the full
 *  editable INSPECTOR (a "Project inspector" region), whose "⤢ Open full page"
 *  affordance routes to the roomy /projects/<id> page. */
async function openProjectPage(page: Page, name: string): Promise<string> {
  await page.getByRole("button", { name: `Open ${name}` }).click();
  const inspector = page.getByRole("region", { name: "Project inspector" });
  await expect(inspector).toBeVisible({ timeout: 15_000 });
  await inspector.getByRole("button", { name: /open full page/i }).click();
  await page.waitForURL(/\/projects\//, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name, level: 1 }),
  ).toBeVisible({ timeout: 30_000 });
  return page.url();
}

test.describe("R4-8 — the roster's data rows are rows", () => {
  test("data rows expose row → cell, and the title opens the project by keyboard", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await signInAs(page, freshTestEmail("roster"));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const name = `QA Roster ${Date.now()}`;
    await addProject(page, name);

    // The row used to be `<tr role="button">`, which took it OUT of the table's
    // structure: only the header row was a `row` at all, and every data value
    // was a `cell` orphaned from its `columnheader`. Header + one data row = 2.
    const table = page.getByRole("table").first();
    await expect(table.getByRole("row")).toHaveCount(2, { timeout: 15_000 });

    // One cell per columnheader, which is what lets a screen reader in table
    // mode announce "Status: …" instead of a bare value.
    const headerRow = table.getByRole("row").first();
    const dataRow = table.getByRole("row").nth(1);
    const columns = await headerRow.getByRole("columnheader").count();
    expect(columns).toBeGreaterThan(1);
    await expect(dataRow.getByRole("cell")).toHaveCount(columns);

    // The three controls that were focusable descendants of a `button` are now
    // in cells of a row, where they are legal.
    await expect(dataRow.getByRole("button", { name: `Delete ${name}` })).toHaveCount(1);
    await expect(
      dataRow.getByRole("button", { name: `Attach recipe to ${name}` }),
    ).toHaveCount(1);

    // Keyboard activation still opens the project — natively, on a real
    // button, rather than through the row's hand-rolled keydown.
    const openTitle = dataRow.getByRole("button", { name: `Open ${name}` });
    await openTitle.focus();
    await expect(openTitle).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("region", { name: "Project inspector" }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

/**
 * R4-4 — the roster's "New project" icon asks for 36x36 and was measured at
 * 20x36 with the inspector open. It is a flex item beside RosterFilterBar and
 * was shrinking with the column; the declared size was never the problem.
 */
test.describe("R4-4 — the roster's add control keeps its width", () => {
  test("New project stays 36px wide with the inspector open", async ({ page }) => {
    test.setTimeout(60_000);
    await signInAs(page, freshTestEmail("addsize"));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const addBtn = page.getByRole("button", { name: "New project", exact: true });
    const name = `QA AddSize ${Date.now()}`;
    await addProject(page, name);

    // Squeeze the roster column: opening the inspector is what the audit did.
    await page.getByRole("button", { name: `Open ${name}` }).click();
    await expect(
      page.getByRole("region", { name: "Project inspector" }),
    ).toBeVisible({ timeout: 15_000 });

    const box = await addBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(36);
    // Was 20 — the button shrank with its flex row while the panel took the
    // width. Squarer than the 24px floor either way, but not the size it asks
    // for, and not the size its unsqueezed twin renders at.
    expect(box!.width).toBeGreaterThanOrEqual(36);
  });
});

test.describe("M11 — Dashboard real-data features", () => {
  test("M11.1 add a calendar event via a day cell → shows in the rail's UPCOMING list", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("planner"));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/ }),
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

  test("M11.2 add a sub-project on the project page → its row carries the progress", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await signInAs(page, freshTestEmail("workspace"));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/ }),
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

    // "+ Sub-project" opens an INLINE form (Ross, 2026-08-01) — name, type,
    // models, priority, status — rather than a type picker that created a
    // placeholder and drilled into it. Adding leaves you on the army so a
    // whole roster can be entered in one place, so there's no tab to flip
    // back from any more.
    const inspector = page.getByRole("region", { name: "Project inspector" });
    await expect(
      inspector.getByRole("heading", { name: army, level: 2 }),
    ).toBeVisible({ timeout: 30_000 });
    await inspector.getByRole("button", { name: /^\+ Sub-project$/ }).click();
    // Type defaults to the first allowed child (Unit for an Army) and models
    // to 1; leaving the name blank yields the "New Unit" placeholder, which
    // keeps this test's downstream assertions unchanged.
    await inspector.getByRole("button", { name: /^\+ Add unit$/i }).click();

    // The new Unit lands in the army's own SUB-PROJECTS list without
    // navigating, carrying its own progress bar. There is no second PROGRESS
    // table on a container any more (Ross, 2026-08-01) — the row IS the
    // progress readout, and the counters are edited on the unit's own page.
    const row = inspector.getByRole("listitem").filter({ hasText: "New Unit" });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByRole("progressbar")).toBeVisible({ timeout: 15_000 });
    await expect(
      inspector.getByRole("button", { name: /increase completed for/i }),
    ).toHaveCount(0);
  });
});
