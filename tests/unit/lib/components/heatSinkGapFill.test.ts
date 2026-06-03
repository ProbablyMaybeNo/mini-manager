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
    // not-owned cell renders a yellow wishlist dot without a refetch.
    expect(src).toContain("wantedOverrides");
    expect(src).toMatch(/stateForPaint[\s\S]*wantedOverrides\.has/);
  });

  test("an already-owned cell never gets downgraded by the override", () => {
    expect(src).toMatch(/fallback === "owned"\)\s*return "owned"/);
  });

  test("the overlay dot uses the effective (optimistic) state, not the raw one", () => {
    // P17: ownership is an overlaid dot keyed off the effective state, not
    // a coloured border. dotClassFor(effectiveState) drives the dot fill.
    expect(src).toContain("stateForPaint(");
    expect(src).toMatch(/dotClassFor\(effectiveState\)/);
  });

  test("P17: no coloured-border ownership indicator on the cell", () => {
    // The old border-based marker is gone — ownership is a dot overlay.
    expect(src).not.toContain("borderClassFor");
  });

  test("candidates rank against the full catalog cells the client holds", () => {
    // allCells={cells} — the full grid, not the density-narrowed visible set.
    expect(src).toMatch(/allCells=\{cells\}/);
  });
});

/* ============================================================
   P16.6 — mobile polish: popover containment + cell sizing + chips.
   Source-level sentinels (no jsdom in this env), matching the
   established client-component test discipline above.
   ============================================================ */

describe("HeatSinkGapFillPopover — mobile bottom sheet via explicit CSS (UX-1301)", () => {
  const src = read("src/components/planner/HeatSinkGapFillPopover.tsx");
  const css = read("src/app/globals.css");

  // The launch-gating regression, third pass: the prior two fixes relied on
  // Tailwind `max-md:` utilities — including `max-md:!top-auto`, whose
  // `!`-PREFIX important syntax silently no-ops under Tailwind v4 (v4 moved
  // the important modifier to a `!` SUFFIX). So the anchored `top` was never
  // overridden and the header + × close rendered above y=0, off-screen and
  // undismissable on a phone. The bulletproof fix: an explicit
  // `@media (max-width:767px)` rule (`.gap-fill-sheet`) with `!important`,
  // immune to the variant quirk. No `max-md:` utilities steer placement.

  test("UX-1301: the dialog carries the .gap-fill-sheet class", () => {
    expect(src).toContain("gap-fill-sheet");
  });

  test("UX-1301: globals.css pins the sheet at width with !important", () => {
    // The rule must live in an explicit max-width media block, force the
    // top to auto and anchor to the viewport bottom — all !important so no
    // inline/anchored value can clip the close button off-screen.
    expect(css).toMatch(/@media \(max-width:\s*767px\)/);
    expect(css).toMatch(/\.gap-fill-sheet\s*\{[\s\S]*?position:\s*fixed\s*!important/);
    expect(css).toMatch(/\.gap-fill-sheet\s*\{[\s\S]*?top:\s*auto\s*!important/);
    expect(css).toMatch(/\.gap-fill-sheet\s*\{[\s\S]*?bottom:\s*calc\(60px[\s\S]*?!important/);
    expect(css).toMatch(/\.gap-fill-sheet\s*\{[\s\S]*?max-height:\s*70vh\s*!important/);
  });

  test("UX-1301: the mobile sheet portals to document.body (escapes the contained ancestor)", () => {
    // Root cause: the P16.4 grid row-groups use content-visibility/contain,
    // which makes them the containing block for position:fixed descendants —
    // so the sheet could never be viewport-relative until it left the subtree.
    // The fix portals to body below 768px (matchMedia-gated, mounted-safe).
    expect(src).toContain('from "react-dom"');
    expect(src).toContain("createPortal");
    expect(src).toContain('matchMedia("(max-width: 767px)")');
    expect(src).toMatch(/sheetToBody\s*\?\s*createPortal\(dialog,\s*document\.body\)\s*:\s*dialog/);
  });

  test("UX-1301: max-md: positioning utilities no longer steer the sheet", () => {
    // The load-bearing applied classes (max-md:fixed / max-md:bottom-… ) are
    // gone from the className — placement is the globals.css rule now. (The
    // docstring still references the v4-incompatible `max-md:!top-auto` to
    // explain WHY, so we assert on the applied classes, not comment prose.)
    expect(src).not.toContain("max-md:fixed");
    expect(src).not.toContain("max-md:inset-x-2");
  });

  test("UX-1301: NO JS-set inline top is ever emitted (would defeat the rule)", () => {
    // The original bug was an inline `top: ...` measured from the cell.
    expect(src).not.toMatch(/style=\{[^}]*top\s*:/);
    expect(src).not.toContain('{ top: "auto" }');
  });

  test("UX-1301: positioning is NOT branched on the isMobile prop", () => {
    // No `isMobile ? <fixed-classes> : <absolute-classes>` ternary. isMobile
    // may still be a perf early-out in the effect, but not a layout selector.
    expect(src).not.toMatch(/isMobile\s*\?\s*clsx/);
    expect(src).not.toMatch(/style=\{isMobile/);
  });

  test("UX-1301: the desktop anchor + flip are md:-scoped only", () => {
    expect(src).toContain("useLayoutEffect");
    expect(src).toContain("getBoundingClientRect");
    expect(src).toMatch(/placement === "above"/);
    expect(src).toContain("md:absolute");
    expect(src).toContain("md:bottom-full md:top-auto");
    expect(src).toContain("md:top-full md:bottom-auto");
  });

  test("flip decision compares space below vs popover height", () => {
    expect(src).toContain("spaceBelow");
    expect(src).toContain("offsetHeight");
    expect(src).toMatch(/setPlacement\(/);
  });

  test("the body scrolls inside a clamped sheet so actions stay reachable", () => {
    // The popover is a flex column with a scrolling body; the globals.css
    // 70vh clamp keeps the Mark-as-wanted buttons inside the scroll area.
    expect(src).toContain("flex flex-col");
    expect(src).toContain("flex-1 overflow-y-auto");
    expect(css).toMatch(/\.gap-fill-sheet\s*\{[\s\S]*?max-height:\s*70vh\s*!important/);
  });
});

describe("HeatSinkGridClient — pixel field + overlay dots (P17)", () => {
  const src = read("src/components/planner/HeatSinkGridClient.tsx");

  test("the grid columns reflow via the fixed-size helper (no density arg)", () => {
    // gridColumnsFor() drives auto-fill columns at the fixed tiny edge so
    // pixels fill the width and pack more with the viewport.
    expect(src).toContain("gridColumnsFor()");
    expect(src).toContain("gridTemplateColumns: gridColumnsFor()");
    expect(src).not.toContain("gridColumnsFor(density)");
  });

  test("off-screen row groups reserve the fixed intrinsic size", () => {
    expect(src).toContain("intrinsicRowSize()");
    expect(src).toContain("containIntrinsicSize");
    expect(src).toContain("[content-visibility:auto]");
    expect(src).not.toContain("intrinsicRowSizeFor");
  });

  test("P17: every paint is a pixel — the cell set is NOT density-filtered", () => {
    // The visible set is the full catalog narrowed only by the brand
    // filter; the unowned 'none' pixels stay (they are the gamut map).
    expect(src).toMatch(/filterCellsByBrands\(cells, brandFilterArray\)/);
    expect(src).not.toContain("condensedCells");
    expect(src).not.toContain("pickDefaultDensity");
  });

  test("P17: owned/wishlist render an overlay dot via dotClassFor", () => {
    expect(src).toContain("dotClassFor(effectiveState)");
    // The dot only renders for owned/wishlist (dotClass truthy); unowned
    // pixels render no dot.
    expect(src).toMatch(/dotClass \?/);
  });

  test("P17: the dot carries a near-black ring (legible over any pixel)", () => {
    // box-shadow ring using the near-black bg token so the dot reads on
    // any underlying spectrum colour.
    expect(src).toContain("shadow-[0_0_0_1px_var(--color-bg)]");
  });

  test("P17: dots use the green/yellow tokens, never amber or cyan", () => {
    // dotClassFor maps owned→green, wishlist→yellow; the legend swatches
    // mirror that. No amber ownership marker, no cyan anywhere.
    expect(src).toContain("bg-[var(--color-green)]");
    expect(src).toContain("bg-[var(--color-yellow)]");
    expect(src).not.toContain("--color-cyan");
  });

  test("P17: no coloured-border ownership indicator remains", () => {
    expect(src).not.toContain("borderClassFor");
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
    // The old condensed/full microcopy is gone.
    expect(src).not.toMatch(/Condensed shows only your collection/i);
  });

  test("P17: copy frames the field as a hue-sorted spectrum / whole gamut", () => {
    expect(src).toMatch(/hue-sorted spectrum/i);
    expect(src).toMatch(/gamut|whole gamut|every paint a pixel/i);
  });

  test("brand chips are real ≥44px-tappable chips that wrap, not prose", () => {
    // `tap-target` gives the touch floor; the label wraps cleanly instead
    // of truncating at the right edge.
    expect(src).toMatch(/tap-target[\s\S]*whitespace-normal/);
    expect(src).not.toContain("truncate max-w-[10rem]");
  });

  test("brand chip row keeps a gap and a right gutter (no edge clipping)", () => {
    expect(src).toMatch(/aria-label="Filter by brand"[\s\S]*gap-1\.5/);
    expect(src).toMatch(/aria-label="Filter by brand"[\s\S]*pr-1/);
  });

  test("the gap-fill popover still receives the mobile gate (UX-1301)", () => {
    expect(src).toContain("detectMobileViewport");
    expect(src).toMatch(/isMobile=\{isMobile\}/);
  });

  // UX-1315 — chip affordance. Brand chips get a resting border + tint so
  // they read as chips (not prose), with a distinct active fill.
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
