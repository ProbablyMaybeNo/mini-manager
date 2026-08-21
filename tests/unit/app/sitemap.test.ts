import { describe, expect, test, vi } from "vitest";

// Stub the DB-backed recipe query so the sitemap builder is unit-testable
// without a database.
vi.mock("@/db/queries/recipes", () => ({
  listPublishedRecipes: async () => [
    { slug: "khorne-berzerkers" },
    { slug: "salamanders-2k" },
  ],
}));

const { default: sitemap } = await import("@/app/sitemap");

describe("sitemap (C2)", () => {
  test("static routes are on the www host and exclude the auth pages", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://www.mini-mainframe.com/");
    expect(urls).toContain("https://www.mini-mainframe.com/gallery");
    expect(urls).not.toContain("https://www.mini-mainframe.com/sign-in");
    expect(urls).not.toContain("https://www.mini-mainframe.com/sign-up");
    expect(urls.every((u) => u.startsWith("https://www.mini-mainframe.com"))).toBe(true);
  });

  /**
   * The SEO landing pages exist to be found. Off the sitemap they are
   * discoverable only by internal link, which is the slow path.
   */
  test.each([
    "/paint-collection-manager",
    "/miniature-wargame-project-tracker",
  ])("SEO landing page %s is in the sitemap", async (route) => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(`https://www.mini-mainframe.com${route}`);
  });

  test("appends every published /r/<slug>", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://www.mini-mainframe.com/r/khorne-berzerkers");
    expect(urls).toContain("https://www.mini-mainframe.com/r/salamanders-2k");
  });
});
