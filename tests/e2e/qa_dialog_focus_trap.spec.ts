import { expect, test, type Page } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * R3-5 — the focus trap must hold in BOTH directions from the freshly-opened
 * state.
 *
 * `ModalDialog` and `useFocusTrap` (SlideOutPanel / ProjectBottomSheet) open by
 * focusing the dialog container, then wrapped Tab only at the two ends of
 * `container.querySelectorAll(...)`. `querySelectorAll` returns DESCENDANTS, so
 * the container is never in that list: on first open `document.activeElement`
 * matched neither end and the keydown handler fell through to the browser.
 * Forward that landed on the first control by luck (the container precedes its
 * children in DOM order); BACKWARD walked straight out of the dialog into the
 * page the dialog had just declared inert via `aria-modal="true"`.
 *
 * Round 2 signed these traps off as correct because it only ever pressed Tab.
 * So every assertion here goes through real `page.keyboard.press(...)`:
 * a programmatic `.focus()` never reaches the keydown handler and passes
 * whether or not the bug is present.
 */

/** Where focus actually is, expressed against the dialog's own focusables. */
async function focusReport(page: Page) {
  return page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const active = document.activeElement as HTMLElement | null;
    if (!dialog) return { open: false, inside: false, index: -2, label: "" };
    const focusables = [
      ...dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ];
    return {
      open: true,
      // `contains` is true for the dialog itself — that IS "inside" here.
      inside: !!active && dialog.contains(active),
      // -1 = the container itself (or something outside); 0..n-1 = a control.
      index: active ? focusables.indexOf(active) : -2,
      count: focusables.length,
      label:
        active?.getAttribute("aria-label") ??
        active?.textContent?.trim().slice(0, 40) ??
        "",
      tag: active?.tagName ?? "",
    };
  });
}

/** Index of the last focusable inside the open dialog. */
async function lastIndex(page: Page) {
  const { count } = (await focusReport(page)) as { count: number };
  return count - 1;
}

async function assertTrapHoldsBothWays(page: Page, dialogName: RegExp) {
  const dialog = page.getByRole("dialog", { name: dialogName });
  const last = await lastIndex(page);
  expect(last).toBeGreaterThan(0);

  // Freshly opened: focus sits on the container, not on any control.
  const opened = await focusReport(page);
  expect(opened.inside).toBe(true);
  expect(opened.index).toBe(-1);

  // BACKWARD from the freshly-opened state — the case that leaked. Must land
  // on the LAST control of the dialog, never on the page behind it.
  await page.keyboard.press("Shift+Tab");
  const back = await focusReport(page);
  expect(back.inside).toBe(true);
  expect(back.index).toBe(last);

  // Backward keeps stepping through the dialog: last -> last-1.
  await page.keyboard.press("Shift+Tab");
  expect((await focusReport(page)).index).toBe(last - 1);

  // Forward steps back to the end, then one more Tab wraps to the first.
  await page.keyboard.press("Tab");
  expect((await focusReport(page)).index).toBe(last);
  await page.keyboard.press("Tab");
  const wrapped = await focusReport(page);
  expect(wrapped.inside).toBe(true);
  expect(wrapped.index).toBe(0);

  // Backward wrap from the first control returns to the last.
  await page.keyboard.press("Shift+Tab");
  const backWrapped = await focusReport(page);
  expect(backWrapped.inside).toBe(true);
  expect(backWrapped.index).toBe(last);

  await expect(dialog).toBeVisible();
}

/**
 * Click the trigger until the dialog is actually up. Both triggers are client
 * islands on a heavy page, so a click that lands pre-hydration is a no-op.
 */
async function openDialog(
  page: Page,
  trigger: ReturnType<Page["getByRole"]>,
  dialog: ReturnType<Page["getByRole"]>,
) {
  await expect(async () => {
    await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/** Forward from the freshly-opened state, checked on its own re-open. */
async function assertForwardFromOpen(page: Page) {
  const opened = await focusReport(page);
  expect(opened.index).toBe(-1);
  await page.keyboard.press("Tab");
  const fwd = await focusReport(page);
  expect(fwd.inside).toBe(true);
  expect(fwd.index).toBe(0);
}

test.describe("Dialog focus trap — both directions (R3-5)", () => {
  test("ModalDialog traps Shift+Tab from the freshly-opened state", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());
    await page.goto("/library", { waitUntil: "domcontentloaded" });

    const trigger = page.getByRole("button", { name: /^Feedback$/i });
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    const dialog = page.getByRole("dialog", { name: /Feedback/i });
    await openDialog(page, trigger, dialog);

    await assertTrapHoldsBothWays(page, /Feedback/i);

    // Esc closes and focus goes back to the control that opened it.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(trigger).toBeFocused();

    // Re-open and check the forward direction from the same fresh state.
    await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await assertForwardFromOpen(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  });

  test("useFocusTrap (SlideOutPanel) traps Shift+Tab from the freshly-opened state", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());
    await page.goto("/library", { waitUntil: "domcontentloaded" });

    const trigger = page.getByRole("button", { name: /^Filter/i });
    await expect(trigger).toBeEnabled({ timeout: 30_000 });
    const dialog = page.getByRole("dialog", { name: /^Filter$/i });
    await openDialog(page, trigger, dialog);

    await assertTrapHoldsBothWays(page, /^Filter$/i);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await assertForwardFromOpen(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  });
});
