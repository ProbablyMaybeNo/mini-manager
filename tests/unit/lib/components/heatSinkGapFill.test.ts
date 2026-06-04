/**
 * M4.2 / D6.2 — gap-fill surface: pure helpers + wiring.
 *
 * Two layers, matching the codebase's client-component test discipline
 * (no jsdom in this Vitest config):
 *
 *   1. Behavioural tests of the pure helpers that shape the gap-fill data:
 *      `buildGapFillCandidates`, `gapFillHeading`, `candidateStateLabel`.
 *   2. Source-level checks pinning the interactive wiring the element-tree
 *      render can't exercise: CollectionGapFill calls the existing actions,
 *      optimistically updates state, and handles dismissal correctly.
 *
 * HeatSinkGapFillPopover is DELETED (M4.2) — its source-scan blocks are
 * removed. CollectionGapFill replaces it and is tested in heatSinkGridCell.test.ts
 * (structural) and here (action wiring focus).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  GAP_FILL_CANDIDATE_COUNT,
  buildGapFillCandidates,
  candidateStateLabel,
  gapFillHeading,
} from "@/components/planner/heatSinkHelpers";
import type { CoverageCell } from "@/db/queries/paintCoverage";
import type { CoverageState } from "@/lib/paints/coverage";
import type { Paint } from "@/lib/paints/types";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

const paint = (id: string, hex: string): Paint => ({
  id,
  brand: "Citadel",
  line: "Base",
  name: id,
  type: "Paint",
  hex,
  hexConfidence: "high",
  hexSource: "stahly",
  sourceUrl: "https://example.com",
});

const cell = (id: string, hex: string, state: CoverageState): CoverageCell => ({
  paint: paint(id, hex),
  state,
});

/* ============================================================
   buildGapFillCandidates
   ============================================================ */

describe("buildGapFillCandidates (P16.5)", () => {
  const target = cell("t", "#ff0000", "none");
  const all: CoverageCell[] = [
    target,
    cell("near1", "#fe0101", "owned"),
    cell("near2", "#f00505", "none"),
    cell("near3", "#e01010", "wanted"),
    cell("far1", "#0000ff", "none"),
    cell("far2", "#00ff00", "none"),
  ];

  test("populates candidates from the catalog", () => {
    const out = buildGapFillCandidates(target, all, 3);
    expect(out.length).toBe(3);
  });

  test("excludes the tapped paint itself", () => {
    const out = buildGapFillCandidates(target, all, 10);
    expect(out.some((c) => c.paint.id === target.paint.id)).toBe(false);
  });

  test("ranks nearest-hue first", () => {
    const out = buildGapFillCandidates(target, all, 5);
    const ids = out.map((c) => c.paint.id);
    expect(ids.slice(0, 3).sort()).toEqual(["near1", "near2", "near3"]);
  });

  test("re-tags each candidate with its live coverage state", () => {
    const out = buildGapFillCandidates(target, all, 5);
    const byId = new Map(out.map((c) => [c.paint.id, c.state]));
    expect(byId.get("near1")).toBe("owned");
    expect(byId.get("near2")).toBe("none");
    expect(byId.get("near3")).toBe("wanted");
  });

  test("respects the candidate count n", () => {
    expect(buildGapFillCandidates(target, all, 2).length).toBe(2);
    expect(buildGapFillCandidates(target, all, 0).length).toBe(0);
  });

  test("defaults to GAP_FILL_CANDIDATE_COUNT", () => {
    const many: CoverageCell[] = [target];
    for (let i = 0; i < 20; i++) many.push(cell("c" + i, "#ff0000", "none"));
    expect(buildGapFillCandidates(target, many).length).toBe(
      GAP_FILL_CANDIDATE_COUNT,
    );
  });
});

/* ============================================================
   gapFillHeading + candidateStateLabel copy
   ============================================================ */

describe("gapFillHeading (P16.5)", () => {
  test("owned cell gets the reassuring 'you own this' frame, no buy nag", () => {
    const h = gapFillHeading("owned", 4);
    expect(h).toContain("You own this");
    expect(h).toContain("4 near matches");
    expect(h.toLowerCase()).not.toContain("buy");
    expect(h.toLowerCase()).not.toContain("gap");
  });

  test("unowned cell gets the 'fill this gap' frame", () => {
    const h = gapFillHeading("none", 6);
    expect(h).toContain("Fill this gap");
    expect(h).toContain("6 near matches");
  });

  test("wanted cell is framed like a gap (still fillable with neighbours)", () => {
    expect(gapFillHeading("wanted", 3)).toContain("Fill this gap");
  });

  test("singular vs plural match copy", () => {
    expect(gapFillHeading("none", 1)).toContain("1 near match");
    expect(gapFillHeading("none", 1)).not.toContain("matches");
  });
});

describe("candidateStateLabel (P16.5)", () => {
  test("maps each coverage state to a label", () => {
    expect(candidateStateLabel("owned")).toBe("Owned");
    expect(candidateStateLabel("wanted")).toBe("Wanted");
    expect(candidateStateLabel("none")).toBe("Not owned");
  });
});

/* ============================================================
   CollectionGapFill — action wiring (source-level, no jsdom)
   ============================================================ */

describe("CollectionGapFill — reuses the existing actions (M4.2)", () => {
  const src = read("src/components/planner/CollectionGapFill.tsx");

  test("imports the existing toggleWishlistedPaint action", () => {
    expect(src).toContain(
      'import { setOwnedCount, toggleWishlistedPaint } from "@/lib/actions/inventory"',
    );
  });

  test("the Want button calls toggleWishlistedPaint with the paint id", () => {
    expect(src).toContain("toggleWishlistedPaint({ paintId })");
  });

  test("fires onMarkedWanted optimistically only after the action succeeds + isWishlisted", () => {
    expect(src).toMatch(/result\.ok[\s\S]*onMarkedWanted/);
    expect(src).toContain("result.data.isWishlisted");
  });

  test("the Own button calls setOwnedCount with count:1", () => {
    expect(src).toContain("setOwnedCount({ paintId, count: 1 })");
  });

  test("fires onMarkedOwned optimistically after setOwnedCount succeeds", () => {
    expect(src).toMatch(/result\.ok[\s\S]*onMarkedOwned/);
  });

  test("the Want action is a solid success Button — no cyan", () => {
    expect(src).toMatch(/variant="success"/);
    expect(src).not.toMatch(/var\(--color-cyan\)/);
  });

  test("owned cells no longer show Want/Own actions (they are already owned)", () => {
    // The actions are conditionally rendered only when liveState !== 'owned'.
    expect(src).toContain("liveState !== \"owned\"");
  });
});

describe("CollectionGapFill — mobile bottom sheet via explicit CSS (UX-1301)", () => {
  const src = read("src/components/planner/CollectionGapFill.tsx");
  const css = read("src/app/globals.css");

  test("the panel carries the .gap-fill-sheet class", () => {
    expect(src).toContain("gap-fill-sheet");
  });

  test("globals.css pins the sheet at width with !important", () => {
    expect(css).toMatch(/@media \(max-width:\s*767px\)/);
    expect(css).toMatch(/\.gap-fill-sheet\s*\{[\s\S]*?position:\s*fixed\s*!important/);
    expect(css).toMatch(/\.gap-fill-sheet\s*\{[\s\S]*?top:\s*auto\s*!important/);
    expect(css).toMatch(/\.gap-fill-sheet\s*\{[\s\S]*?bottom:\s*calc\(60px[\s\S]*?!important/);
    expect(css).toMatch(/\.gap-fill-sheet\s*\{[\s\S]*?max-height:\s*70vh\s*!important/);
  });

  test("the mobile sheet portals to document.body (escapes any contained ancestor)", () => {
    expect(src).toContain('from "react-dom"');
    expect(src).toContain("createPortal");
    expect(src).toContain('matchMedia("(max-width: 767px)")');
    expect(src).toMatch(/sheetToBody\s*\?\s*createPortal\(panel,\s*document\.body\)\s*:\s*panel/);
  });
});

describe("HeatSinkGridClient — canvas + gap-fill surface wiring (M4.2)", () => {
  const src = read("src/components/planner/HeatSinkGridClient.tsx");

  test("opens CollectionGapFill on canvas pick (pickedCell state)", () => {
    expect(src).toContain("pickedCell");
    expect(src).toContain("CollectionGapFill");
    expect(src).toContain("handlePickCell");
  });

  test("optimistic wanted override flips a none cell's state to wanted", () => {
    expect(src).toContain("wantedOverrides");
    expect(src).toMatch(/stateForPaint[\s\S]*wantedOverrides\.has/);
  });

  test("optimistic owned override flips a none/wanted cell's state to owned", () => {
    expect(src).toContain("ownedOverrides");
    expect(src).toMatch(/stateForPaint[\s\S]*ownedOverrides\.has/);
  });

  test("an already-owned cell never gets downgraded by either override", () => {
    expect(src).toMatch(/fallback === "owned"[\s\S]*return "owned"/);
  });

  test("candidates rank against the full catalog cells the client holds", () => {
    // CollectionGapFill receives allCells={cells} — the full grid.
    expect(src).toMatch(/allCells=\{cells\}/);
  });

  test("the overlay dot uses the effective (optimistic) state via stateForPaint", () => {
    // CollectionCanvas receives stateForPaint={stateForPaint}.
    expect(src).toMatch(/stateForPaint=\{stateForPaint\}/);
  });

  test("no coloured-border ownership indicator remains", () => {
    expect(src).not.toContain("borderClassFor");
  });

  test("no dotClassFor import (canvas uses token colours directly)", () => {
    expect(src).not.toContain("dotClassFor");
    expect(src).not.toContain("COVERAGE_DOT_CLASS");
  });

  test("P17: the density toggle is gone entirely", () => {
    expect(src).not.toContain("DensityButton");
    expect(src).not.toContain('density === "condensed"');
    expect(src).not.toContain("GridDensity");
    expect(src).not.toContain("Condensed");
  });

  test("P17: legend copy names the green-owned / yellow-wishlist dots", () => {
    expect(src).toMatch(/green.*owned/i);
    expect(src).toMatch(/yellow.*wishlist/i);
    expect(src).not.toMatch(/Condensed shows only your collection/i);
  });

  test("P17: copy frames the field as a hue-sorted spectrum / whole gamut", () => {
    expect(src).toMatch(/hue-sorted spectrum/i);
    expect(src).toMatch(/gamut|whole gamut|every paint a pixel/i);
  });

  test("brand chips are real ≥44px-tappable chips that wrap, not prose", () => {
    expect(src).toMatch(/tap-target[\s\S]*whitespace-normal/);
    expect(src).not.toContain("truncate max-w-[10rem]");
  });

  test("brand chip row keeps a gap and a right gutter (no edge clipping)", () => {
    expect(src).toMatch(/aria-label="Filter by brand"[\s\S]*gap-1\.5/);
    expect(src).toMatch(/aria-label="Filter by brand"[\s\S]*pr-1/);
  });

  test("UX-1315: brand chips have a resting fill + strong border affordance", () => {
    expect(src).toContain("border-[var(--color-border-strong)]");
    expect(src).toMatch(
      /bg-\[color-mix\(in_srgb,var\(--color-fg-muted\)_8%,transparent\)\]/,
    );
  });

  test("UX-1315: the active brand chip flips to the solid amber fill", () => {
    expect(src).toMatch(
      /bg-\[var\(--color-amber\)\] text-\[var\(--color-bg\)\] border-\[var\(--color-amber\)\]/,
    );
  });
});
