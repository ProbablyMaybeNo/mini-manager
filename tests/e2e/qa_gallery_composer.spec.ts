import { expect, test } from "@playwright/test";
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";
import { projects, recipes, recipeSlots, projectImages, users, sessions } from "../../src/db/schema";
import { signInAs, freshTestEmail } from "./_helpers/auth";

// Use only a disposable local database shared with the test server.
const databaseUrl = process.env.GALLERY_TEST_DATABASE_URL;
test.use({ actionTimeout: 15_000 });
test.skip(!databaseUrl?.startsWith("file:"), "Requires a disposable local gallery test database");

test("gallery, project and recipe share one editable composer with a real PNG export", async ({ page, baseURL }, testInfo) => {
  test.setTimeout(90_000);
  // Avoid truncated gzip chunks served by the Windows webpack dev server.
  await page.setExtraHTTPHeaders({ "Accept-Encoding": "identity" });
  const client = createClient({ url: databaseUrl! });
  const db = drizzle(client);
  let userId: string;
  if (process.env.GALLERY_PRODUCTION_BUILD === "1") {
    expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
    userId = randomUUID().slice(0, 16);
    const token = randomUUID();
    await db.insert(users).values({ id: userId, email: freshTestEmail("gallery-card"), username: `gallery-${userId}`, passwordHash: hashSync("local-test-only", 10), plan: "pro_lifetime" });
    await db.insert(sessions).values({ userId, sessionToken: token, expires: new Date(Date.now() + 3600_000) });
    await page.context().addCookies([
      { name: "authjs.session-token", value: token, url: baseURL!, httpOnly: true, sameSite: "Lax" },
      { name: "__Secure-authjs.session-token", value: token, domain: new URL(baseURL!).hostname, path: "/", httpOnly: true, secure: true, sameSite: "Lax" },
    ]);
  } else {
    userId = (await signInAs(page, freshTestEmail("gallery-card"))).userId;
  }
  const parent = `army-${userId}`;
  const child = `squad-${userId}`;
  const recipe = `scheme-${userId}`;
  await db.insert(projects).values([
    { id: parent, ownerId: userId, name: "Test army", type: "Army" },
    { id: child, ownerId: userId, parentId: parent, name: "Test squad", type: "Unit", count: 5, notesMd: "Drybrush the armour." },
  ]);
  await db.insert(recipes).values({ id: recipe, ownerId: userId, name: "Armour recipe", attachedProjectId: child, bodyType: "infantry", notesMd: "Thin layers, then edge highlight." });
  await db.insert(recipeSlots).values({ recipeId: recipe, position: 0, technique: "basecoat", customColorHex: "#265c9e" });
  await db.insert(projectImages).values({ projectId: child, ownerId: userId, url: "/brand/mini-mainframe-mark.png", pathname: "test-local-image" });
  client.close();

  await page.goto("/gallery");
  const dialog = page.getByRole("dialog", { name: "Create gallery card" });
  await expect(async () => {
    await page.getByRole("button", { name: "Create", exact: true }).first().click();
    await expect(dialog).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("");
  await dialog.getByRole("combobox", { name: "Start from a project" }).click();
  await dialog.getByRole("option", { name: "Test army / Test squad", exact: true }).click();
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("Test squad");
  await expect(dialog.getByLabel("Model count", { exact: true })).toHaveValue("5");
  await expect(dialog.getByLabel("Part of", { exact: true })).toHaveValue("Test army");
  await expect(dialog.getByLabel("Recipe name", { exact: true })).toHaveValue("Armour recipe");
  await expect(dialog.getByLabel("Technique notes", { exact: true })).toHaveValue("Thin layers, then edge highlight.");
  await expect(dialog.getByRole("img", { name: "Painted model", exact: true })).toBeVisible();

  await dialog.getByRole("combobox", { name: "Start from a project" }).click();
  await dialog.getByRole("option", { name: "Create new — blank card", exact: true }).click();
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("Project", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("Recipe name", { exact: true })).toHaveValue("");
  await expect(dialog.getByRole("img", { name: "Painted model", exact: true })).toHaveCount(0);
  await dialog.getByLabel("Title", { exact: true }).fill("My painted squad");
  await dialog.getByLabel("Project", { exact: true }).fill("My squad");
  await dialog.getByLabel("Model count", { exact: true }).fill("3");
  await dialog.getByRole("combobox", { name: "Add recipe" }).click();
  await dialog.getByRole("option", { name: "Armour recipe", exact: true }).click();
  await expect(dialog.getByLabel("Recipe name", { exact: true })).toHaveValue("Armour recipe");
  await dialog.getByLabel("Upload a photo for the card").setInputFiles("tests/fixtures/mini-mainframe-logo-poster.jpg");
  await dialog.getByRole("button", { name: "Add paint", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Pick & Paint", exact: true });
  await expect(picker).toBeVisible();
  await picker.getByRole("searchbox", { name: "Filter library paints" }).fill("Macragge Blue");
  await picker.getByRole("button", { name: /Macragge Blue/i }).first().click();
  await expect(dialog.getByRole("button", { name: "Remove Macragge Blue", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Download card", exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("composer-desktop.png"), fullPage: true });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download card", exact: true }).click(),
  ]);
  const pngPath = testInfo.outputPath("exported-card.png");
  await download.saveAs(pngPath);
  const png = await readFile(pngPath);
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1080);

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.getByTestId("share-card-preview").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("composer-mobile.png"), fullPage: true });
  await dialog.getByRole("radio", { name: "9:16 STORY", exact: true }).click();
  const [storyDownload] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download card", exact: true }).click(),
  ]);
  const storyPath = testInfo.outputPath("exported-story.png");
  await storyDownload.saveAs(storyPath);
  const story = await readFile(storyPath);
  expect(story.readUInt32BE(16)).toBe(1080);
  expect(story.readUInt32BE(20)).toBeCloseTo(1920, -1);
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/projects/${child}`);
  await page.getByRole("button", { name: "Share card", exact: true }).click();
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("Test squad");
  await expect(dialog.getByLabel("Recipe name", { exact: true })).toHaveValue("Armour recipe");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.goto(`/recipes/${recipe}`);
  await page.getByRole("button", { name: "Share card", exact: true }).click();
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("Armour recipe");
  await expect(dialog.getByLabel("Project", { exact: true })).toHaveValue("Test squad");
  await expect(dialog.getByRole("button", { name: "Post to gallery", exact: true })).toBeVisible();
});
