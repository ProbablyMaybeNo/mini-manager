/**
 * D1 — Desktop shell & layout foundations (desktop UX/UI plan).
 *
 * Static source-scan regression net for the D1 acceptance criteria —
 * the foundations every later desktop pane/table relies on:
 *
 *   1. Density lever: --density-row-h / --density-card-pad-* tokens with
 *      a `html[data-density="compact"]` override; card padding + dense
 *      table rows consume the tokens so the toggle flips row heights +
 *      padding app-wide.
 *   2. Density control: a Comfortable/Compact toggle on /user driving the
 *      tokens via the useDensity hook, with a no-FOUC bootstrap applied on
 *      <html> before first paint from the root layout.
 *   3. Content width cap: a --content-cap token + `.content-cap` utility
 *      so wide pages don't sprawl into 200-char lines on an ultrawide.
 *   4. Focus + table semantics: scroll-padding so the focus ring isn't
 *      hidden behind sticky chrome, and `aria-sort` on the Projects
 *      column headers (the <th>, i.e. role=columnheader — not the inner
 *      button, where AT ignores it).
 *
 * Mirrors the targetSizeAudit / buttonSweep source-scan convention (node
 * env, fs.readFileSync) — no DOM, no dev server.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("D1 density lever — tokens + compact override", () => {
  const css = read("src/app/globals.css");

  test("defines the density tokens (row height + card padding)", () => {
    expect(css).toMatch(/--density-row-h:\s*40px/);
    expect(css).toMatch(/--density-card-pad-y:\s*14px/);
    expect(css).toMatch(/--density-card-pad-x:\s*14px/);
  });

  test("compact density override tightens the tokens on <html>", () => {
    expect(css).toMatch(
      /html\[data-density="compact"\]\s*\{[\s\S]*?--density-row-h:\s*32px/,
    );
  });

  test("card padding is density-driven (flips app-wide)", () => {
    expect(css).toMatch(
      /\.card-body\s*\{[\s\S]*?var\(--density-card-pad-y\)\s+var\(--density-card-pad-x\)/,
    );
  });

  test("dense table rows track the density lever", () => {
    expect(css).toMatch(
      /\.mm-density-rows tbody tr\s*\{[\s\S]*?height:\s*var\(--density-row-h\)/,
    );
  });
});

describe("D1 content-width cap", () => {
  const css = read("src/app/globals.css");

  test("defines a --content-cap token and a .content-cap utility", () => {
    expect(css).toMatch(/--content-cap:\s*\d+px/);
    expect(css).toMatch(/\.content-cap\s*\{[\s\S]*?max-width:\s*var\(--content-cap\)/);
  });
});

describe("D1 focus-ring pass", () => {
  const css = read("src/app/globals.css");

  test("focus ring is ≥2px and offset on the CRT surface", () => {
    expect(css).toMatch(
      /:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--color-cyan\)[\s\S]*?outline-offset:\s*2px/,
    );
  });

  test("scroll-padding keeps the focused control clear of sticky chrome", () => {
    expect(css).toMatch(/scroll-padding-top/);
  });
});

describe("D1 useDensity hook contract", () => {
  const hook = read("src/lib/hooks/useDensity.ts");

  test("exports the hook, type, storage key, and no-FOUC bootstrap", () => {
    expect(hook).toMatch(/export function useDensity\b/);
    expect(hook).toMatch(/export type Density\b/);
    expect(hook).toMatch(/export const DENSITY_STORAGE_KEY\b/);
    expect(hook).toMatch(/export const DENSITY_BOOTSTRAP_SCRIPT\b/);
  });

  test("compact is reflected on <html data-density>, comfortable removes it", () => {
    expect(hook).toMatch(/setAttribute\("data-density",\s*"compact"\)/);
    expect(hook).toMatch(/removeAttribute\("data-density"\)/);
  });
});

describe("D1 bootstrap is wired into the root layout (no FOUC)", () => {
  const layout = read("src/app/layout.tsx");

  test("imports and injects DENSITY_BOOTSTRAP_SCRIPT before content", () => {
    expect(layout).toMatch(
      /import \{ DENSITY_BOOTSTRAP_SCRIPT \} from "@\/lib\/hooks\/useDensity"/,
    );
    expect(layout).toMatch(
      /dangerouslySetInnerHTML=\{\{ __html: DENSITY_BOOTSTRAP_SCRIPT \}\}/,
    );
  });
});

describe("D1 density control on /user", () => {
  test("the user page renders the DensityCard", () => {
    const page = read("src/app/user/page.tsx");
    expect(page).toMatch(/import \{ DensityCard \}/);
    expect(page).toMatch(/<DensityCard\s*\/>/);
  });

  test("DensityCard drives useDensity through a SegmentedControl", () => {
    const card = read("src/components/user/DensityCard.tsx");
    expect(card).toMatch(/useDensity\(\)/);
    expect(card).toMatch(/<SegmentedControl\b/);
    expect(card).toMatch(/comfortable/);
    expect(card).toMatch(/compact/);
  });
});

describe("D1 aria-sort on the Projects column headers", () => {
  const src = read("src/components/ProjectsDashboardTable.tsx");

  test("aria-sort sits on the <th> (columnheader), not the inner button", () => {
    const start = src.indexOf("function Th(");
    const end = src.indexOf("function DashboardRow");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // Strip line comments so prose mentioning "<th>"/"aria-sort" can't
    // shadow the real JSX tags.
    const th = src.slice(start, end).replace(/\/\/[^\n]*/g, "");

    // aria-sort must live inside the <th …> opening tag (role=columnheader).
    const thOpenTag = th.match(/<th\b[^>]*>/);
    expect(thOpenTag?.[0], "<th> opening tag not found").toBeTruthy();
    expect(thOpenTag![0]).toMatch(/aria-sort=/);

    // …and NOT on the inner <button>, where assistive tech ignores it.
    const buttonOpenTag = th.match(/<button\b[^>]*>/);
    expect(buttonOpenTag?.[0], "<button> opening tag not found").toBeTruthy();
    expect(buttonOpenTag![0]).not.toMatch(/aria-sort=/);
  });
});
