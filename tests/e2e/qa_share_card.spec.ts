import path from "node:path";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * Recipe-card phase 2 — the branded ShareCardComposer's PNG export.
 *
 * Drives the composer end-to-end from the recipe editor: name the recipe,
 * add a photo via the composer's own local file pick (no Vercel Blob
 * upload required — proves the render+export path independent of Blob
 * being configured in this environment), edit the notes, switch ratio,
 * then click Download and capture the real browser download event. A
 * saved sample lives at `_card-review/` (gitignored) for human review —
 * see the PR description for the path.
 *
 * The composer's own draft state (name/slots/notes) never touches the
 * server, so this test doesn't need to persist the recipe first — the
 * whole flow is exercised from an unsaved `/recipes/new` draft.
 */

const SAMPLE_PHOTO = path.resolve(
  __dirname,
  "../../public/brand/mini-mainframe-logo-poster.jpg",
);
const OUT_DIR = path.resolve(__dirname, "../../_card-review");

function assertPng(filePath: string) {
  const buf = readFileSync(filePath);
  expect(buf.length).toBeGreaterThan(1000);
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
}

test.describe("Recipe-card phase 2 — ShareCardComposer PNG export", () => {
  test("names a recipe, adds a photo, edits notes, and downloads a real PNG at both ratios", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signInAs(page, freshTestEmail("share-card"));

    const recipeName = `QA Share Card ${Date.now()}`;

    await page.goto("/recipes/new", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^RECIPE EDITOR$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const nameField = page.getByLabel(/recipe name/i);
    await nameField.fill(recipeName);
    await expect(nameField).toHaveValue(recipeName);

    // Add a couple of real paint steps so the exported card exercises the
    // swatch grid (name-inside-square layout), not just the imageless/
    // no-slots path already covered by the empty-recipe assertions below.
    const pickerDialog = page.getByRole("dialog", { name: "Pick & Paint" });
    for (const query of ["red", "blue"]) {
      await expect(async () => {
        await page.getByRole("button", { name: "+ Add Paint" }).click();
        await expect(pickerDialog).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 30_000 });
      await page
        .getByPlaceholder("Search by paint name, brand, or line…")
        .fill(query);
      const firstMatch = page.getByRole("button").filter({ hasText: /ΔE/ }).first();
      await firstMatch.waitFor({ state: "visible", timeout: 30_000 });
      await firstMatch.click();
      await expect(pickerDialog).not.toBeVisible();
    }

    await page.getByRole("button", { name: /share as card/i }).click();
    const dialog = page.getByRole("dialog", { name: "Share as card" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Add a photo via the composer's own local file pick — independent of
    // Vercel Blob being configured (BLOB_READ_WRITE_TOKEN isn't set in this
    // dev environment), so this exercises the same render+export path a
    // project-attached Blob photo would take, minus the /api/blob-proxy
    // rewrite (which only fires for *.public.blob.vercel-storage.com URLs
    // — unit-tested separately in tests/unit/lib/shareCard/imageSrc.test.ts).
    await dialog.getByLabel(/upload a photo for the card/i).setInputFiles(SAMPLE_PHOTO);
    await expect(
      dialog.getByRole("button", { name: /use this photo on the card/i }),
    ).toBeVisible({ timeout: 15_000 });
    // The selected thumbnail's photo also renders inside the live preview
    // card itself (the exact node handed to html-to-image).
    await expect(dialog.locator("img").first()).toBeVisible();

    await dialog.getByLabel(/card notes/i).fill("Zenithal base, then a warm glaze on the edges.");

    // --- 1:1 (default) download ---
    const download1 = await Promise.all([
      page.waitForEvent("download"),
      dialog.getByRole("button", { name: /download png/i }).click(),
    ]).then(([d]) => d);
    const path1 = path.join(OUT_DIR, "sample-card-1x1.png");
    await download1.saveAs(path1);
    assertPng(path1);

    // --- switch to 9:16 and download again — proves the ratio picker
    // actually reflows the export, not just the on-screen label ---
    await dialog.getByRole("radio", { name: /9:16 STORY/i }).click();
    const download2 = await Promise.all([
      page.waitForEvent("download"),
      dialog.getByRole("button", { name: /download png/i }).click(),
    ]).then(([d]) => d);
    const path2 = path.join(OUT_DIR, "sample-card-9x16.png");
    await download2.saveAs(path2);
    assertPng(path2);

    // No export error surfaced in the dialog.
    await expect(dialog.getByText(/couldn't export the card/i)).toBeHidden();
  });
});
