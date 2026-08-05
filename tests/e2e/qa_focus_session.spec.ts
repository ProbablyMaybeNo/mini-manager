import { expect, test, type Page } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * R4-7 — a running focus session must survive leaving the bench.
 *
 * The stopwatch used to live entirely in component state, so navigating to
 * LIBRARY to look a paint up — the single most likely thing a painter does
 * mid-session — unmounted it and the elapsed time was dropped, not banked:
 * back on the bench the clock read 00:00:00, the button read "Start", and
 * TIME / TODAY / WEEK were unchanged.
 *
 * The assertion below goes through a real in-app nav LINK, not `page.goto`.
 * A hard load proves nothing about a client-side app, and the client-side path
 * is the one a painter actually takes.
 */

/**
 * The clock as a painter sees it. `Stopwatch` mounts two renderings of one
 * timer (phone bar + desktop panel) and hides one with `display:none`, so the
 * visible one is picked by `offsetParent` rather than by index.
 */
async function visibleClock(page: Page): Promise<string> {
  return page.evaluate(() => {
    const spans = [...document.querySelectorAll("span")];
    const clock = spans.find(
      (node) =>
        /^\d{2}:\d{2}:\d{2}$/.test(node.textContent?.trim() ?? "") &&
        node.offsetParent !== null,
    );
    return clock?.textContent?.trim() ?? "";
  });
}

function toSeconds(clock: string): number {
  const [h, m, s] = clock.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

/** Create a project so the bench has something to focus — `FocusView` renders
 *  its "NO SESSION" empty state (and no stopwatch) without one. */
async function addProject(page: Page, name: string): Promise<void> {
  const addBtn = page.getByRole("button", { name: "New project", exact: true });
  const nameField = page.getByLabel("Name", { exact: true });
  await expect(async () => {
    await addBtn.click();
    await expect(nameField).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await nameField.fill(name);
  await nameField.blur();
  await page.getByRole("button", { name: "Close project inspector" }).click();
}

test.describe("Focus session survives navigation (R4-7)", () => {
  test("a running timer is still running after an in-app round trip", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signInAs(page, freshTestEmail());
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await addProject(page, "Bench Timer");

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible({ timeout: 30_000 });
    await nav.getByRole("link", { name: "FOCUS" }).click();
    await expect(page).toHaveURL(/\/focus/, { timeout: 30_000 });

    const start = page.getByRole("button", { name: "Start", exact: true });
    await expect(start).toBeVisible({ timeout: 30_000 });
    expect(await visibleClock(page)).toBe("00:00:00");

    await start.click();
    const stop = page.getByRole("button", { name: "Stop", exact: true });
    await expect(stop).toBeVisible({ timeout: 15_000 });

    // Let it accumulate something worth losing.
    await expect
      .poll(async () => toSeconds(await visibleClock(page)), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);
    const beforeLeaving = toSeconds(await visibleClock(page));

    // ── The journey that used to discard it: a CLIENT-SIDE nav away… ──────
    await nav.getByRole("link", { name: "LIBRARY" }).click();
    await expect(page).toHaveURL(/\/library/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Stop", exact: true })).toHaveCount(0);

    // …and back, again through a link, not page.goto.
    await nav.getByRole("link", { name: "FOCUS" }).click();
    await expect(page).toHaveURL(/\/focus/, { timeout: 30_000 });

    // Still RUNNING (the control reads Stop, not Start) and the elapsed time
    // has kept going rather than resetting. Before the fix: "Start", 00:00:00.
    await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Start", exact: true })).toHaveCount(0);
    expect(toSeconds(await visibleClock(page))).toBeGreaterThanOrEqual(beforeLeaving);

    // And it is a real session, not a frozen number: it is still ticking.
    await expect
      .poll(async () => toSeconds(await visibleClock(page)), { timeout: 15_000 })
      .toBeGreaterThan(beforeLeaving);
  });

  test("a reload restores the same running session", async ({ page }) => {
    test.setTimeout(90_000);
    await signInAs(page, freshTestEmail());
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await addProject(page, "Bench Reload");

    await page.goto("/focus", { waitUntil: "domcontentloaded" });
    const start = page.getByRole("button", { name: "Start", exact: true });
    await expect(start).toBeVisible({ timeout: 30_000 });
    await start.click();
    await expect
      .poll(async () => toSeconds(await visibleClock(page)), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);
    const beforeReload = toSeconds(await visibleClock(page));

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    expect(toSeconds(await visibleClock(page))).toBeGreaterThanOrEqual(beforeReload);
  });

  test("logging the session ends it — the bench comes back clean", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signInAs(page, freshTestEmail());
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await addProject(page, "Bench Log");

    await page.goto("/focus", { waitUntil: "domcontentloaded" });
    const start = page.getByRole("button", { name: "Start", exact: true });
    await expect(start).toBeVisible({ timeout: 30_000 });
    await start.click();
    await expect
      .poll(async () => toSeconds(await visibleClock(page)), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);

    await page.getByRole("button", { name: "Log", exact: true }).click();
    await expect(start).toBeVisible({ timeout: 15_000 });
    expect(await visibleClock(page)).toBe("00:00:00");

    // A logged session must not come back from storage on the next visit.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: "Start", exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    expect(await visibleClock(page)).toBe("00:00:00");
  });
});
