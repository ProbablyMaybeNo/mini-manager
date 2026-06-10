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

  test("WHEEL header leads with the recipe-flow explainer (2026-06-04 rework)", () => {
    // The wheel page now authors a recipe rather than planning a
    // standalone palette: the header explainer points the painter at the
    // assign-paint → attach/save recipe flow. The wheel-mechanic line
    // survives as a secondary hint, minus the retired "Find in library"
    // standalone-planner copy.
    const src = read("src/components/tools/wheel/WheelClient.tsx");
    expect(src).toMatch(
      /Use the colour wheel to plan a recipe — assign a paint to each\s+colour, then attach it to a project or save it for later\./,
    );
    expect(src).toMatch(/Drag the primary pick\. Switch harmony with the bar below\./);
    expect(src).not.toMatch(/Find in library/);
  });
});

describe("Section microcopy under primary headings (P11.12)", () => {
  test("/projects page has a one-line subheading", () => {
    const src = read("src/app/projects/page.tsx");
    expect(src).toMatch(/Project hub, everything you need/);
  });

  test("/projects/new explains the choice", () => {
    const src = read("src/app/projects/new/page.tsx");
    expect(src).toMatch(/Pick the kind of thing you/);
  });

  test("/recipes index has a plain-prose tagline (FIGMA-REBUILD §5)", () => {
    // FIGMA-REBUILD §5 — the recipes page tagline was rewritten to the
    // share-focused line; the old "stack of colour slots" subheading is
    // gone. The slot vocabulary now lives in the SlotList inline help.
    const src = read("src/app/recipes/page.tsx");
    expect(src).toMatch(
      /Build and share paint recipes for every model in your collection\./,
    );
  });

  test("/collection subheading is plain-prose (no internal refs)", () => {
    // FIGMA-REBUILD §8 — /wishlist + /collections merged into the new
    // singular /collection. Subheading is plain prose describing the
    // paint + model collections.
    const src = read("src/app/collection/page.tsx");
    expect(src).not.toMatch(/P2\.5/);
    expect(src).toMatch(/paint and model collections/i);
  });

  test("/user has the multi-section header", () => {
    const src = read("src/app/user/page.tsx");
    expect(src).toMatch(/account, plan, and data tools/);
  });

  test("Recipe SlotList carries the flat-slot inline help", () => {
    // 2026-06-04 flatten: a slot is one paint + its layer. The inline
    // help points at the + Add paint tile + the click-to-swap path.
    const src = read("src/components/recipes/SlotList.tsx");
    expect(src).toContain("Each slot is one paint and the layer");
    expect(src).toContain("+ Add paint");
  });

  test("StageCounter renders the cascade explainer microcopy", () => {
    const src = read("src/components/StageCounter.tsx");
    expect(src).toMatch(/Each stage flows into the next/);
  });
});
