import { expect, test, type Page } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M12 — Project-page recipe wiring (redesign/v2-hexcode).
 *
 * The v2 project PAGE (/projects/<id>) grew a RECIPE card with two real paths
 * (no dead /recipes link):
 *   - "+ Create"  → mints a recipe already attached to this project and opens
 *     the editor at /recipes/<id>?from=<projectId> with a "‹ back to <project>"
 *     return control (commit cea2ef4).
 *   - "+ Attach"  → opens the RecipePickerDialog to attach one of the painter's
 *     existing recipes to this project (commits c5ecd31 / 1672fe3).
 *
 * DB-level persistence + ownership scoping for attachRecipeToProject /
 * createRecipe(attachedProjectId) are already covered at the integration layer
 * (recipes.test.ts). These missions drive the redesigned page UI end-to-end and
 * assert the wiring fires — anchored on deterministic signals (URL, the back
 * control's text, the picker dialog opening/closing) rather than the RECIPE
 * card's swatch count, which only reflects recipes that carry painted slots.
 */

/**
 * Create a top-level project from the dashboard (v2 HEX.CODE flow). "+ New
 * project" creates a draft Army immediately (no name/model-count mini-form —
 * a deliberate redesign choice, not a regression, see MISSIONS.md bug B6) and
 * opens its editable INSPECTOR panel, where the "Name" field renames it.
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

/**
 * Open the project PAGE for a dashboard row. A row's body click opens the full
 * editable INSPECTOR (a "Project inspector" region), whose "⤢ Open full page"
 * affordance routes to the roomy /projects/<id> page.
 *
 * R2-11 — this helper used to take the first URL flip as arrival, which is why
 * M12.2 failed only under full-suite parallel load (it passed in isolation, and
 * predates the round-2 work — it lives on main). Instrumenting `history` in a
 * throttled browser showed the actual race, and it is not a slow page:
 *
 *   1. Opening the inspector calls `window.history.pushState` directly
 *      (ProjectPanelStack's MOP-004 back-button integration). Next patches
 *      `history.pushState`, so that turns into an app-router action that has to
 *      resolve before the router settles.
 *   2. With the main thread starved, that action is STILL PENDING when the
 *      "⤢ Open full page" push commits. `waitForURL(/\/projects\//)` passes and
 *      the page renders — the test has "arrived".
 *   3. ~2.5s later the stale action resolves against the old canonical URL, and
 *      Next pushes `/dashboard` back on top. The project page is gone, and the
 *      h1 assertion fails against a dashboard that looks untouched — exactly
 *      the reported failure.
 *
 * So the readiness signal has to be "still here", not "got here": each attempt
 * arrives and then watches for the bounce, and a bounce retries the whole open
 * instead of failing the mission. The retry is what makes it correct rather
 * than merely slower — the second attempt starts with no stale action pending.
 * (Deliberately not `--workers=1` and not `test.describe.serial`: both would
 * hide this rather than absorb it.)
 */
async function openProjectPage(page: Page, name: string): Promise<string> {
  const heading = page.getByRole("heading", { name, level: 1 });
  const manage = page.getByRole("button", { name: `Manage ${name}` });
  const inspector = page.getByRole("region", { name: "Project inspector" });

  await expect(async () => {
    if (!(await heading.isVisible())) {
      await manage.click();
      await expect(inspector).toBeVisible({ timeout: 15_000 });
      await inspector.getByRole("button", { name: /open full page/i }).click();
      await page.waitForURL(/\/projects\//, { timeout: 30_000 });
      await expect(heading).toBeVisible({ timeout: 30_000 });
    }
    // The bounce is a Next-internal navigation with nothing in the page to
    // subscribe to, so it is watched for rather than awaited: landing back on
    // /dashboard fails this attempt fast, and no bounce costs the window once.
    const bounced = await page
      .waitForURL(/\/dashboard/, { timeout: 2_500 })
      .then(() => true)
      .catch(() => false);
    if (bounced) {
      throw new Error(
        `bounced back to /dashboard after opening ${name} — stale router action`,
      );
    }
    await expect(heading).toBeVisible();
  }).toPass({ timeout: 90_000 });

  return page.url();
}

test.describe("M12 — Project-page recipe wiring", () => {
  test("M12.1 + Create mints an attached recipe and returns via ‹ back to <project>", async ({
    page,
  }) => {
    // create → project page → editor hand-off → return: more hops than the
    // default 30s allows once the dev server is compiling each route cold, plus
    // openProjectPage's R2-11 bounce watch (and its retry) on top.
    test.setTimeout(120_000);
    await signInAs(page, freshTestEmail("prj-recipe"));

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const army = `QA Army ${Date.now()}`;
    await addProject(page, army);
    const projectUrl = await openProjectPage(page, army);
    const projectId = projectUrl.split("/projects/")[1].split(/[?#]/)[0];

    // The RECIPE card starts empty (no attached recipe carries swatches yet).
    await expect(page.getByText(/NO RECIPES ATTACHED/i)).toBeVisible({
      timeout: 15_000,
    });

    // "+ Create" mints a recipe already attached to this project and opens the
    // editor with the ?from=<projectId> hand-off.
    await page.getByRole("button", { name: /^\+ Create$/ }).click();
    await page.waitForURL(
      new RegExp(`/recipes/[^?]+\\?(?:.*&)?from=${projectId}`),
      { timeout: 30_000 },
    );

    // The editor's back control reads "‹ back to <project>" (not the plain
    // "← Recipes" index return) because the recipe belongs to the project.
    const backControl = page.getByRole("button", { name: `back to ${army}` });
    await expect(backControl).toBeVisible({ timeout: 30_000 });

    // Clicking it returns to the project page — the create-from-project loop.
    await backControl.click();
    await page.waitForURL(new RegExp(`/projects/${projectId}`), {
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", { name: army, level: 1 }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("M12.2 + Attach opens the picker and attaches an existing recipe to the project", async ({
    page,
  }) => {
    // Two openProjectPage hops, each carrying the R2-11 bounce watch + retry.
    test.setTimeout(150_000);
    await signInAs(page, freshTestEmail("prj-attach"));

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // Mint a recipe by creating it FOR project A (the only zero-editor path to a
    // persisted recipe), then return to the dashboard. The recipe is named
    // "<A> recipe" and now shows up in every project's attach picker.
    const armyA = `QA Alpha ${Date.now()}`;
    await addProject(page, armyA);
    await openProjectPage(page, armyA);
    await page.getByRole("button", { name: /^\+ Create$/ }).click();
    await page.waitForURL(/\/recipes\/[^?]+\?(?:.*&)?from=/, { timeout: 30_000 });
    const recipeName = `${armyA} recipe`;
    await page
      .getByRole("button", { name: `back to ${armyA}` })
      .click();
    await page.waitForURL(/\/projects\//, { timeout: 30_000 });

    // Second project B — the recipe attach picker should offer recipe R so we
    // can move its link onto B (attachRecipeToProject, c5ecd31).
    await page.getByRole("button", { name: /Back to projects/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const armyB = `QA Bravo ${Date.now()}`;
    await addProject(page, armyB);
    await openProjectPage(page, armyB);

    // Open the RecipePickerDialog from B's RECIPE card.
    await page.getByRole("button", { name: /^\+ Attach/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(
      dialog.getByText(new RegExp(`Attach a recipe to ${armyB}`, "i")),
    ).toBeVisible({ timeout: 15_000 });

    // Pick recipe R (created for A) → attaches it to B and closes the dialog.
    await dialog.getByRole("button", { name: recipeName }).click();

    // Deterministic success signal: the picker dialog closes once the attach
    // action resolves. (A "Attached <name>" toast also fires, but auto-dismisses
    // at 2.4s so it isn't a reliable gate under dev-server load.)
    await expect(dialog).toBeHidden({ timeout: 30_000 });
  });
});
