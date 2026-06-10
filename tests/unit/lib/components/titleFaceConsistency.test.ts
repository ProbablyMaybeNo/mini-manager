/**
 * UX-012 — the signature title face (.title-display / PixelSplitter) on
 * every page-top section H1, for one coherent OS identity.
 *
 * DESIGN_LANGUAGE §3 reserves the pixel display face for short, glanceable
 * page-top lockups ("body stays readable, no pixel-font walls of text").
 * So the contract is:
 *   - every STATIC page-top H1 (the section name) carries .title-display,
 *   - the two EDITABLE user-name titles (project + recipe detail) are
 *     deliberately EXCLUDED — they hold long, user-typed names that the
 *     pixel font would make fatiguing to read + edit (the §3 readability
 *     floor). They stay plain cyan mono.
 *   - sr-only / boot-hero / auth-lockup H1s are not section titles.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "../../../../src/app");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

// Static page-top section titles that must wear the title face.
//
// FIGMA-REBUILD §2 — the page-top lockup was centralised into the shared
// <PageHeader> primitive, which renders the page's single <h1> in
// PixelSplitter (`.title-display`) in the page accent colour. So the
// contract is no longer "the page source contains a `.title-display`
// <h1>" (the literal <h1> now lives inside PageHeader) — it's "the page
// renders its title through PageHeader, and PageHeader renders a
// title-display <h1>".
const TITLED_PAGES = [
  "projects/page.tsx", // DASHBOARD
  // FOCUS-FOLD (2026-06-08) — the standalone /planner (FOCUS) page is
  // gone; FOCUS is now a section inside the dashboard (an <h2>, not a
  // page-top <h1>), so it drops off this page-top-H1 list.
  "library/page.tsx",
  "recipes/page.tsx",
  "tools/page.tsx",
  // FIGMA-REBUILD §8 — /collections + /wishlist merged into the singular
  // /collection.
  "collection/page.tsx",
  "user/page.tsx",
  "pricing/page.tsx",
];

describe("UX-012 — title face on every static page-top title", () => {
  test("PageHeader renders the page-top <h1> in the title face", () => {
    const src = fs.readFileSync(
      path.resolve(root, "../components/ui/PageHeader.tsx"),
      "utf-8",
    );
    // The single <h1> the primitive emits carries `.title-display`.
    expect(src).toMatch(/<h1[\s\S]*?className="title-display/);
  });

  for (const rel of TITLED_PAGES) {
    test(`${rel} renders its page-top title via PageHeader`, () => {
      const src = read(rel);
      expect(src).toContain("<PageHeader");
      // No page re-rolls its own visible page-top <h1> with the old plain
      // mono treatment (PageHeader owns the title face).
      const h1s = src.match(/<h1[^>]*className="[^"]*"/g) ?? [];
      const visible = h1s.filter((h) => !/sr-only/.test(h));
      for (const h of visible) {
        expect(h, `${rel}: any visible H1 must use .title-display`).toMatch(
          /title-display/,
        );
      }
    });
  }
});

describe("UX-012 — editable name titles stay readable (deliberate exclusion)", () => {
  test("EditableProjectTitle does NOT use the pixel display face", () => {
    const src = fs.readFileSync(
      path.resolve(root, "../components/EditableProjectTitle.tsx"),
      "utf-8",
    );
    expect(src).toMatch(/<h1/);
    expect(src).not.toMatch(/title-display/);
  });
  test("RecipeHeader editable title does NOT use the pixel display face", () => {
    const src = fs.readFileSync(
      path.resolve(root, "../components/recipes/RecipeHeader.tsx"),
      "utf-8",
    );
    expect(src).toMatch(/<h1/);
    expect(src).not.toMatch(/title-display/);
  });
});
