/**
 * P11.12 — Microcopy pass: tool-page headers + section-heading helpers.
 *
 * Each tool's H1 carries a single plain-prose ≤ ~80-char subheading
 * explaining what the tool does in painter vocabulary, not implementation
 * jargon (no `ΔE`, `K-means`, `Lab-space`). Rolls forward into a
 * regression net so future commits can't quietly re-introduce jargon.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

describe("Tool page subheadings — plain prose, no jargon (P11.12)", () => {
  test("MATCH H1 subheading drops the ΔE jargon", () => {
    // Note: ΔE survives as a results-table column label — that's data,
    // not subheading prose. We only check the header microcopy.
    const src = read("src/components/tools/match/MatchClient.tsx");
    expect(src).toMatch(/identical to the eye/);
    expect(src).not.toMatch(/Green\s+dot = ΔE/);
  });

  test("EYEDROPPER copy drops K-means reference", () => {
    const src = read("src/components/tools/eyedropper/EyedropperClient.tsx");
    expect(src).not.toMatch(/K-means/);
    expect(src).toMatch(/extracts six dominant colours/);
  });

  test("GRADIENT copy drops Lab-space jargon", () => {
    const src = read("src/components/tools/gradient/GradientClient.tsx");
    expect(src).not.toMatch(/in Lab so/);
    expect(src).toMatch(/transitions feel even across the eye/);
  });

  test("WHEEL subheading is preserved (no jargon to retire)", () => {
    const src = read("src/components/tools/wheel/WheelClient.tsx");
    expect(src).toMatch(/Drag the primary pick\. Switch harmony with the bar below\./);
  });
});

describe("Section microcopy under primary headings (P11.12)", () => {
  test("/projects page has a one-line subheading", () => {
    const src = read("src/app/projects/page.tsx");
    expect(src).toMatch(/Your wargaming workbench/);
  });

  test("/projects/new explains the choice", () => {
    const src = read("src/app/projects/new/page.tsx");
    expect(src).toMatch(/Pick the kind of thing you/);
  });

  test("/recipes index uses 'colour slot' vocabulary", () => {
    const src = read("src/app/recipes/page.tsx");
    expect(src).toMatch(/stack of\s+colour slots/);
  });

  test("/wishlist subheading is plain-prose (no P2.5 ref)", () => {
    const src = read("src/app/wishlist/page.tsx");
    expect(src).not.toMatch(/P2\.5/);
    // P12.12 — wishlist split into Paints + Models tables. Subheading
    // updated to match: "Paints and models you want to buy" replaces
    // the earlier "Paints, kits, and tools" phrasing.
    expect(src).toMatch(/Paints and models you want to buy/);
  });

  test("/user has the multi-section header", () => {
    const src = read("src/app/user/page.tsx");
    expect(src).toMatch(/account, plan, and data tools/);
  });

  test("Recipe ZoneList carries the colour-slot inline help", () => {
    // P12.2 replaced "Each colour slot is one part of the model" with
    // a click-to-pick affordance pointer (recipes are about COLOR,
    // not model parts, per Ross's locked brief). R7-002 then sharpened
    // the copy: ADD on +, REPLACE on filled, layer via the Steps
    // panel.
    const src = read("src/components/recipes/ZoneList.tsx");
    expect(src).toContain("Click any");
    expect(src).toContain("slot to ADD a new colour");
  });

  test("StageCounter renders the cascade explainer microcopy", () => {
    const src = read("src/components/StageCounter.tsx");
    expect(src).toMatch(/Each stage flows into the next/);
  });
});
