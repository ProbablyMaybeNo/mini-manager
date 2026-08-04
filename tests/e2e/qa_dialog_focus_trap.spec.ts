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

/**
 * R4-1 / R4-2 / R4-3 — the shell the R3-5 pass above cannot reach, because
 * every dialog it drives has NO autofocus field. `PromptDialog` has one, and
 * that single difference was enough to break focus restore: React applies
 * `autoFocus` during commit, before effects, so `useFocusTrap` captured the
 * dialog's own input as "the element that was focused before" and teardown
 * .focus()'d a node that had just unmounted. Focus landed on <body>.
 *
 * The same dialog also shipped a bare <label> with no `htmlFor`, so its only
 * field had no accessible name at all.
 */
test.describe("PromptDialog — named field, honoured autofocus, real restore", () => {
  test("labels its field, opens on it, and returns focus to the trigger", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());
    await page.goto("/collection", { waitUntil: "domcontentloaded" });

    const trigger = page.getByRole("button", { name: "+ PAINT", exact: true });
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    const dialog = page.getByRole("dialog", { name: /Add paint/i });
    await openDialog(page, trigger, dialog);

    // R4-1 — the visible "Paint name" is the field's accessible name, not
    // decoration. `getByLabel` resolves through the accessibility tree, which
    // is precisely what a bare <label> failed to reach.
    const field = dialog.getByLabel("Paint name");
    await expect(field).toBeVisible();
    expect(
      await field.evaluate((node: HTMLInputElement) => ({
        labels: node.labels?.length ?? 0,
        ariaLabel: node.getAttribute("aria-label"),
        ariaLabelledBy: node.getAttribute("aria-labelledby"),
      })),
    ).toEqual({ labels: 1, ariaLabel: null, ariaLabelledBy: null });

    // R4-3 — the field asked for focus on open and now actually has it, so a
    // one-field "type the name" dialog can be typed into without a Tab first.
    await expect(field).toBeFocused();
    await page.keyboard.type("Macragge Blue");
    await expect(field).toHaveValue("Macragge Blue");

    // R4-2 — Escape returns focus to the control that opened the dialog, not
    // to <body>. Measured before the fix: `document.body`.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(trigger).toBeFocused();
    expect(
      await page.evaluate(() => document.activeElement?.tagName ?? ""),
    ).not.toBe("BODY");

    // Cancel takes the same path as Escape — the button a mouse user reaches
    // for, and the one the audit walked.
    await openDialog(page, trigger, dialog);
    await dialog.getByRole("button", { name: /^Cancel$/ }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(trigger).toBeFocused();
  });
});
