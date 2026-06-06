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
const TITLED_PAGES = [
  "projects/page.tsx", // DASHBOARD
  "planner/page.tsx", // FOCUS
  "library/page.tsx",
  "recipes/page.tsx",
  "tools/page.tsx",
  "wishlist/page.tsx",
  "user/page.tsx",
  "pricing/page.tsx",
];

describe("UX-012 — title face on every static page-top H1", () => {
  for (const rel of TITLED_PAGES) {
    test(`${rel} H1 uses .title-display`, () => {
      const src = read(rel);
      // Find every <h1 ...> opening tag and assert at least one carries
      // title-display, and none of the VISIBLE (non-sr-only) ones use the
      // old plain `text-3xl tracking-wide` mono treatment.
      const h1s = src.match(/<h1[^>]*className="[^"]*"/g) ?? [];
      expect(h1s.length).toBeGreaterThan(0);
      const visible = h1s.filter((h) => !/sr-only/.test(h));
      expect(visible.length).toBeGreaterThan(0);
      for (const h of visible) {
        expect(h, `${rel}: visible H1 must use .title-display`).toMatch(
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
