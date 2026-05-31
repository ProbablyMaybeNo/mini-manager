import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M10 — Hydration / SSR integrity
 *
 * Regression guard for the class of bug where a component renders one thing
 * on the server and another on the client, triggering a React hydration
 * mismatch (which throws away the server HTML and re-renders). These show up
 * only as console errors, so the rest of the suite stays green while the bug
 * ships. This mission loads representative pages and fails on any hydration
 * complaint.
 *
 * Origin: StatusBar derived NET status from `navigator.onLine` during render.
 * Modern Node exposes a global `navigator` with `onLine === undefined`, so
 * SSR rendered `NET · OFF` while the browser hydrated to `NET · ON`. Fixed by
 * rendering deterministic placeholders on first paint and correcting in an
 * effect after mount.
 */

const HYDRATION_PATTERN =
  /hydrat|did not match|server rendered|text content does not match|tree hydrated/i;

test.describe("M10 — Hydration / SSR integrity", () => {
  test("M10.1 — core app pages mount with no hydration mismatch", async ({
    page,
  }) => {
    const offences: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error" && HYDRATION_PATTERN.test(msg.text())) {
        offences.push(`console.error: ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => {
      if (HYDRATION_PATTERN.test(err.message)) {
        offences.push(`pageerror: ${err.message}`);
      }
    });

    await signInAs(page, freshTestEmail("hydration"));

    // Each carries the desktop chrome (StatusBar) + its own page shell.
    for (const path of ["/projects", "/library", "/recipes", "/tools"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      // Give React a beat to flush any hydration warning to the console.
      await page.waitForTimeout(300);
    }

    expect(
      offences,
      `Hydration mismatch(es) detected:\n${offences.join("\n")}`,
    ).toEqual([]);
  });
});
