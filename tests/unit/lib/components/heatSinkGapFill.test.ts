/**
 * P16.5 — gap-fill popover view helpers + client/popover wiring.
 *
 * Two layers, matching the codebase's client-component test discipline
 * (no jsdom in this Vitest config — see stageCounterOptimistic.test.ts):
 *
 *   1. Behavioural tests of the pure helpers that shape the popover data:
 *      `buildGapFillCandidates` (near-hue candidates, excludes self,
 *      re-tags each with its live coverage state, respects `n`),
 *      `gapFillHeading` (owned vs unowned copy), `candidateStateLabel`.
 *   2. Source-level checks pinning the interactive wiring the element-tree
 *      render can't exercise: the tap opens a popover, the "Mark as wanted"
 *      calls the EXISTING `toggleWishlistedPaint` action, the success path
 *      optimistically flips the cell border to amber, and the owned-cell
 *      variant keeps the reassuring copy (no buy nag).
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
  // A spread of reds → the target red's nearest neighbours are the other
  // reds, ordered by colour distance; far hues rank last.
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
    // The three reds beat the blue + green.
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
   Popover wiring — source-level (no jsdom in this env).
   ============================================================ */

describe("HeatSinkGapFillPopover — reuses the existing wishlist action (P16.5)", () => {
  const src = read("src/components/planner/HeatSinkGapFillPopover.tsx");

  test("imports the existing toggleWishlistedPaint action, not a new one", () => {
    expect(src).toContain(
      'import { toggleWishlistedPaint } from "@/lib/actions/inventory"',
    );
  });

  test("the Mark-as-wanted button calls toggleWishlistedPaint with the paint id", () => {
    expect(src).toContain("toggleWishlistedPaint({ paintId })");
  });

  test("fires the optimistic amber flip only after the action succeeds", () => {
    // onMarkedWanted (the optimistic flip) is gated behind result.ok +
    // the returned row landing wishlisted.
    expect(src).toMatch(/result\.ok[\s\S]*onMarkedWanted/);
    expect(src).toContain("result.data.isWishlisted");
  });

  test("the wishlist add is a solid success Button — no cyan on the action", () => {
    expect(src).toMatch(/variant="success"/);
    expect(src).not.toMatch(/var\(--color-cyan\)/);
  });

  test("dismisses on Escape and click-outside, z-50, viewport-clamped", () => {
    expect(src).toContain('e.key === "Escape"');
    expect(src).toContain("contains(e.target as Node)");
    expect(src).toContain("z-50");
    expect(src).toContain("max-w-[calc(100vw-1.5rem)]");
  });

  test("no raw hex literals in className strings (fills are inline-style data)", () => {
    // Allow hex only inside style={{ backgroundColor }} (paint data); the
    // className tokens must stay @theme. Scan className= occurrences.
    const classNameHexes = src
      .split("className=")
      .slice(1)
      .map((chunk) => chunk.split("/>")[0] ?? chunk)
      .join("\n")
      .match(/#[0-9a-fA-F]{3,8}\b/g);
    expect(classNameHexes).toBeNull();
  });
});

describe("HeatSinkGridClient — tap opens popover + optimistic border (P16.5)", () => {
  const src = read("src/components/planner/HeatSinkGridClient.tsx");

  test("mounts the gap-fill popover for the open cell", () => {
    expect(src).toContain("HeatSinkGapFillPopover");
    expect(src).toContain("openPaintId");
  });

  test("a tap toggles the cell's popover open/closed", () => {
    expect(src).toMatch(/setOpenPaintId\([\s\S]*cell\.paint\.id/);
  });

  test("optimistic wanted override flips a none cell's state to wanted", () => {
    // markWanted adds to wantedOverrides; stateForPaint reads it back so a
    // not-owned cell renders wanted (amber) without a refetch.
    expect(src).toContain("wantedOverrides");
    expect(src).toMatch(/stateForPaint[\s\S]*wantedOverrides\.has/);
  });

  test("an already-owned cell never gets downgraded by the override", () => {
    expect(src).toMatch(/fallback === "owned"\)\s*return "owned"/);
  });

  test("the cell border uses the effective (optimistic) state, not the raw one", () => {
    expect(src).toContain("stateForPaint(");
    expect(src).toMatch(/borderClassFor\(effectiveState\)/);
  });

  test("candidates rank against the full catalog cells the client holds", () => {
    // allCells={cells} — the full grid, not the density-narrowed visible set.
    expect(src).toMatch(/allCells=\{cells\}/);
  });
});
