import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { signInAs } from "./_helpers/auth";

/**
 * Not a QA mission — a capture utility. Drives the seeded dev account through
 * the six screens the landing page showcases and writes real 1440×900 PNGs into
 * public/showcase, so the marketing page never carries a mockup.
 *
 * Run manually:
 *   npm run db:seed && npx tsx scripts/seed-showcase.mts
 *   CAPTURE_SHOWCASE=1 npx playwright test capture_showcase --project=chromium
 * (needs a dev server with ALLOW_TEST_AUTH=1; skipped without the env var so a
 * normal suite run never rewrites public/showcase).
 */
const OUT = path.join(process.cwd(), "public", "showcase");

/** `height` overrides the default 900 when a page needs more room to show its
 *  whole point (the tools hub has five cards; four fit in 900px). The landing
 *  entry for that shot carries the matching intrinsic height. */
const SHOTS: { file: string; url: string; ready: string; height?: number }[] = [
  { file: "projects.png", url: "/dashboard", ready: "PROJECTS ROSTER" },
  { file: "library.png", url: "/library", ready: "LIBRARY" },
  { file: "tools.png", url: "/tools", ready: "Color Wheel", height: 1420 },
  { file: "collection.png", url: "/collection", ready: "PAINTS" },
  { file: "recipe.png", url: "/recipes", ready: "RECIPE" },
  { file: "focus.png", url: "/focus", ready: "FOCUS" },
];

test("capture showcase screenshots", async ({ page }) => {
  // Opt-in only: this WRITES into public/, so it must never fire as part of a
  // normal `npx playwright test` run.
  test.skip(
    !process.env.CAPTURE_SHOWCASE,
    "set CAPTURE_SHOWCASE=1 to re-shoot the landing screenshots",
  );
  test.setTimeout(180_000);
  await mkdir(OUT, { recursive: true });
  await signInAs(page, "dev@local");

  for (const shot of SHOTS) {
    await page.setViewportSize({ width: 1440, height: shot.height ?? 900 });
    await page.goto(shot.url);
    await expect(page.getByText(shot.ready, { exact: false }).first()).toBeVisible({
      timeout: 30_000,
    });
    // Let fonts + any deferred imagery settle so the capture isn't mid-paint.
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, shot.file) });
  }
});
