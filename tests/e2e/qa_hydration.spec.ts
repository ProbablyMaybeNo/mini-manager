import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M10 — Hydration / SSR integrity.
 *
 * Regression guard for server/client render mismatches (a class of bug
 * that only surfaces as a console error while the rest of the suite stays
 * green). This mission loads the current core app routes and fails on any
 * React hydration complaint.
 *
 * Uses waitUntil:"domcontentloaded" (never networkidle — the dev server's
 * first compile of each route is slow on this filesystem) plus a short
 * settle so React can flush any hydration warning to the console.
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

    // Each route carries the app chrome (SidebarRail / MobileTopBar) plus
    // its own page shell.
    for (const path of [
      "/dashboard",
      "/library",
      "/recipes",
      "/tools",
      "/collection",
      "/focus",
    ]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      // Give React a beat to flush any hydration warning to the console.
      await page.waitForTimeout(500);
    }

    expect(
      offences,
      `Hydration mismatch(es) detected:\n${offences.join("\n")}`,
    ).toEqual([]);
  });
});
