import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * R2-10 — a rejected server action must not destroy the password-reset pages.
 *
 * Both `(public)` reset pages awaited a server action inside `startTransition`
 * with no try/catch. `src/app/error.tsx` is the ROOT boundary, so a rejection
 * (offline, dropped connection, 5xx) replaced the whole app with the "SOMETHING
 * BROKE" fault screen. This is the worst surface for that: the visitor is
 * already locked out of their account, and on `/sign-in/reset` the token is
 * single-use, so a crash mid-submit leaves them with no message and no way to
 * tell whether the reset applied.
 *
 * These missions drive the real failure — `context.setOffline(true)` — and
 * assert the page survives it: no fault screen, form still mounted, an inline
 * message, and the typed input intact.
 */

const FAULT_SCREEN = /something broke/i;
const RETRYABLE = /check your connection, then try again/i;

/**
 * Hydration probe. Both forms disable their submit until the controlled value
 * is long enough, so an ENABLED submit proves React is attached and its
 * onChange is running — which matters here more than anywhere: a pre-hydration
 * submit falls through to the bare `<form>`'s default GET, which never calls
 * the server action at all and would pass every assertion below for the wrong
 * reason. Refilling inside the retry re-fires onChange once React catches up.
 */
async function fillOnceInteractive(
  field: Locator,
  submit: Locator,
  value: string,
): Promise<void> {
  await expect(async () => {
    await field.fill("");
    await field.fill(value);
    await expect(submit).toBeEnabled({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

/** The fault screen replaces the whole tree, so its absence is the assertion
 *  that the rejection stayed inside the form. */
async function expectNoFaultScreen(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: FAULT_SCREEN })).toHaveCount(0);
}

/** Scoped to the form: Next mounts its own always-present `role="alert"` route
 *  announcer on every page, so an unscoped alert query matches two nodes. */
function inlineError(page: Page): Locator {
  return page.locator("form").getByRole("alert");
}

/** By type, not by name: the submit swaps its label to the in-flight verb, so a
 *  name-based locator stops resolving exactly when the assertion needs it. */
function submitButton(page: Page): Locator {
  return page.locator('form button[type="submit"]');
}

test.describe("R2-10 — the reset pages survive a rejected action", () => {
  test("R2-10.1 /reset reports the failure inline and keeps the typed username", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/reset", { waitUntil: "domcontentloaded" });

    const username = page.getByLabel("Username", { exact: true });
    const submit = submitButton(page);
    await expect(username).toBeVisible({ timeout: 30_000 });

    const typed = "lockedoutpainter";
    await fillOnceInteractive(username, submit, typed);

    await context.setOffline(true);
    await submit.click();

    // The form stays put and says what happened…
    await expect(inlineError(page)).toContainText(RETRYABLE, {
      timeout: 30_000,
    });
    // …instead of the root boundary eating the app.
    await expectNoFaultScreen(page);

    // Still the form, not the "a reset link is on its way" confirmation — the
    // request never reached the server, so claiming it did would be a lie.
    await expect(username).toBeVisible();
    await expect(username).toHaveValue(typed);
    // Retrying is just pressing it again.
    await expect(submit).toBeEnabled();

    await context.setOffline(false);
  });

  test("R2-10.2 /sign-in/reset reports the failure inline and keeps the typed password", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/sign-in/reset?token=qa-r2-10-token", {
      waitUntil: "domcontentloaded",
    });

    const password = page.getByLabel(/new password/i);
    const submit = submitButton(page);
    await expect(password).toBeVisible({ timeout: 30_000 });

    const typed = "longenoughpw";
    await fillOnceInteractive(password, submit, typed);

    await context.setOffline(true);
    await submit.click();

    await expect(inlineError(page)).toContainText(RETRYABLE, {
      timeout: 30_000,
    });
    await expectNoFaultScreen(page);

    await expect(password).toBeVisible();
    await expect(password).toHaveValue(typed);
    await expect(submit).toBeEnabled();

    await context.setOffline(false);
  });

  test("R2-10.3 the submit button disables while the reset is in flight", async ({
    page,
  }) => {
    // The single-use token's other half: without a pending flag nothing stopped
    // a second submit, which spends the token and reports "invalid or expired"
    // for a reset that had already succeeded. Holding the action open makes the
    // in-flight window observable instead of a millisecond-wide race.
    test.setTimeout(60_000);
    await page.goto("/sign-in/reset?token=qa-r2-10-inflight", {
      waitUntil: "domcontentloaded",
    });

    const password = page.getByLabel(/new password/i);
    const submit = submitButton(page);
    await expect(password).toBeVisible({ timeout: 30_000 });
    await fillOnceInteractive(password, submit, "longenoughpw");

    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/sign-in/reset**", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await held;
      await route.abort("failed");
    });

    await submit.click();

    await expect(submit).toBeDisabled({ timeout: 15_000 });
    await expect(submit).toHaveText(/setting/i);

    release();

    // And it comes back, reporting the failure rather than crashing.
    await expect(inlineError(page)).toContainText(RETRYABLE, {
      timeout: 30_000,
    });
    await expectNoFaultScreen(page);
    await expect(submit).toBeEnabled();
  });
});
