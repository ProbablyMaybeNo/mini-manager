/**
 * UI-GLOW — terminal text-glow pass.
 *
 * The CRT aesthetic gets a tiered, hue-matched text-shadow "phosphor"
 * glow applied app-wide from globals.css:
 *
 *   --glow-body    very subtle bloom on ALL regular text (set on <html>)
 *   --glow-strong  stronger bloom on titles (h1-h3), interactive text
 *                  (links), and outline buttons
 *   --glow-intense reserved max-bloom tier for hero/brand lockups
 *
 * Every tier derives its colour from `currentColor` via color-mix, so the
 * halo always matches the glyph's own hue (cyan H1 glows cyan, green
 * status glows green) without hard-coding a colour — and crucially the
 * glyph-vs-background contrast is unchanged, so text stays WCAG-AA.
 *
 * Glow is DECORATIVE: it never carries state, so the reduced-motion block
 * strips every tier. These source-sentinel assertions pin the contract so
 * a future refactor can't silently drop the bloom or hard-code a hue.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

const css = read("src/app/globals.css");

describe("globals.css — UI-GLOW text-glow tokens", () => {
  test("all three glow tiers are declared in @theme", () => {
    expect(css).toMatch(/--glow-body:\s*[^;]+;/);
    expect(css).toMatch(/--glow-strong:\s*[\s\S]+?;/);
    expect(css).toMatch(/--glow-intense:\s*[\s\S]+?;/);
  });

  test("every tier derives its halo from currentColor (hue-agnostic)", () => {
    // The glow must follow the text's own colour, not a hard-coded hue.
    const themeBlock = css.split("@theme")[1] ?? "";
    for (const tier of ["--glow-body", "--glow-strong", "--glow-intense"]) {
      const decl = new RegExp(`${tier}:\\s*([\\s\\S]*?);`).exec(themeBlock);
      expect(decl, `${tier} declaration`).not.toBeNull();
      expect(decl![1]).toContain("currentColor");
    }
  });

  test("the body tier is the subtlest (a single ~3px bloom)", () => {
    // Dense prose/tables must stay crisp — body glow is one small radius.
    const decl = /--glow-body:\s*([^;]+);/.exec(css);
    expect(decl).not.toBeNull();
    expect(decl![1]).toMatch(/0 0 3px/);
    // A single shadow layer keeps it a whisper, not a blur: exactly one
    // `0 0 <r>` halo offset (color-mix's own commas are ignored).
    expect((decl![1] ?? "").match(/0 0 \d+px/g)?.length).toBe(1);
  });

  test("the strong tier is a multi-layer (stronger) bloom", () => {
    const decl = /--glow-strong:\s*([\s\S]*?);/.exec(css);
    expect(decl).not.toBeNull();
    // Two comma-joined halos = the brighter title/interactive tier.
    expect((decl![1] ?? "").match(/0 0 \d+px/g)?.length).toBeGreaterThanOrEqual(
      2,
    );
  });
});

describe("globals.css — UI-GLOW application surfaces", () => {
  test("the body tier is applied to <html> so all regular text glows", () => {
    expect(css).toMatch(/html\s*\{[\s\S]*?text-shadow:\s*var\(--glow-body\)/);
  });

  test("titles (h1/h2/h3) take the strong tier", () => {
    expect(css).toMatch(/h1\s*\{[\s\S]*?text-shadow:\s*var\(--glow-strong\)/);
    expect(css).toMatch(/h2\s*\{[\s\S]*?text-shadow:\s*var\(--glow-strong\)/);
    expect(css).toMatch(/h3\s*\{[\s\S]*?text-shadow:\s*var\(--glow-strong\)/);
  });

  test("interactive text (links) takes the strong tier", () => {
    expect(css).toMatch(/\na\s*\{[\s\S]*?text-shadow:\s*var\(--glow-strong\)/);
  });

  test("outline buttons glow; solid-fill buttons are excluded", () => {
    // Outline buttons carry coloured text on a dark ground → glow.
    expect(css).toMatch(
      /\.btn-outline\s*\{[\s\S]*?text-shadow:\s*var\(--glow-strong\)/,
    );
    // Solid .btn base must NOT carry a glow (black text on bright fill
    // would bloom dark). Guard the base .btn block specifically.
    const btnBase = /\n\.btn\s*\{([\s\S]*?)\}/.exec(css);
    expect(btnBase).not.toBeNull();
    expect(btnBase![1]).not.toContain("text-shadow");
  });
});

describe("globals.css — UI-GLOW reusable utilities", () => {
  test("hue-agnostic .glow-text* utility classes exist for each tier", () => {
    expect(css).toMatch(/\.glow-text\s*\{\s*text-shadow:\s*var\(--glow-body\)/);
    expect(css).toMatch(
      /\.glow-text-strong\s*\{\s*text-shadow:\s*var\(--glow-strong\)/,
    );
    expect(css).toMatch(
      /\.glow-text-intense\s*\{\s*text-shadow:\s*var\(--glow-intense\)/,
    );
  });
});

describe("globals.css — UI-GLOW respects reduced motion", () => {
  test("a prefers-reduced-motion block strips every glow surface", () => {
    const rmBlocks = css.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}/g,
    );
    expect(rmBlocks).not.toBeNull();
    const joined = (rmBlocks ?? []).join("\n");
    // The consolidated kill-switch must cover the new tiers + base surfaces.
    expect(joined).toMatch(/\.glow-text-strong[\s\S]*?text-shadow:\s*none/);
    expect(joined).toMatch(/html[\s\S]*?text-shadow:\s*none/);
  });
});
