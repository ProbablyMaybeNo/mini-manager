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
 * R2-11 wrapped this in an arrive-then-watch-for-a-bounce retry, because the
 * inspector used to unwind its own `history.pushState` entries with
 * `history.go(-n)` — a traversal that resolved after the "⤢ Open full page"
 * push had landed and threw the painter back to /dashboard. R2-17 moved the
 * drill stack into the URL (`?open=…&sub=…`), so the panel no longer issues any
 * history traversal on close or unmount and there is nothing left to bounce
 * off. The plain sequence is the honest assertion again.
 */
async function openProjectPage(page: Page, name: string): Promise<string> {
  const heading = page.getByRole("heading", { name, level: 1 });
  const inspector = page.getByRole("region", { name: "Project inspector" });

  if (!(await heading.isVisible())) {
    await page.getByRole("button", { name: `Manage ${name}` }).click();
    await expect(inspector).toBeVisible({ timeout: 15_000 });
    await inspector.getByRole("button", { name: /open full page/i }).click();
    await page.waitForURL(/\/projects\//, { timeout: 30_000 });
  }
  await expect(heading).toBeVisible({ timeout: 30_000 });

  return page.url();
}

test.describe("M12 — Project-page recipe wiring", () => {
  test("M12.1 + Create mints an attached recipe and returns via ‹ back to <project>", async ({
    page,
  }) => {
    // create → project page → editor hand-off → return: more hops than the
    // default 30s allows once the dev server is compiling each route cold.
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
    // Two openProjectPage hops on top of the create + attach round trips.
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
