/**
 * UX-910 — Library paint name mobile truncation.
 *
 * On 414px viewports the BRAND column was a fixed 90px which crowded
 * long paint names ("507a Admiralty Dark Grey" → "507a Admiralty…").
 * The fix gives NAME ~1.5× BRAND's share via fr-based minmax columns
 * and lets BRAND wrap to 2 lines on mobile.
 *
 * Source-string assertions: LibraryTable.tsx is a use-client virtualised
 * grid, so we lock the layout tokens rather than render-test it. The
 * exact CSS shape is the contract — a future refactor that walks back
 * the fr-ratio would silently regress the truncation bug.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = fs.readFileSync(
  path.resolve(__dirname, "../../../../src/components/library/LibraryTable.tsx"),
  "utf-8",
);

describe("LibraryTable mobile layout (UX-910)", () => {
  test("mobile grid uses fr-based ratio for BRAND vs NAME (not fixed 90px)", () => {
    // The mobile grid columns are the first set in GRID_CLASS, before
    // the md: prefix. The old layout had `90px` for BRAND; the new one
    // uses `minmax(0,1fr)` for BRAND and `minmax(0,1.5fr)` for NAME.
    expect(SRC).toContain(
      "grid-cols-[24px_minmax(0,1fr)_minmax(0,1.5fr)_24px_60px_36px_28px]",
    );
    // No 90px brand column anywhere in the mobile spec.
    expect(SRC).not.toMatch(/grid-cols-\[24px_90px_minmax/);
  });

  test("NAME gets ~1.5× BRAND's share on mobile", () => {
    // The literal ratio is locked: 1fr for BRAND, 1.5fr for NAME.
    // If a future tweak rebalances these the assertion forces a
    // conscious decision rather than silent drift.
    const mobileMatch = SRC.match(
      /grid-cols-\[24px_minmax\(0,(\d+(?:\.\d+)?)fr\)_minmax\(0,(\d+(?:\.\d+)?)fr\)_/,
    );
    expect(mobileMatch).not.toBeNull();
    if (!mobileMatch) return;
    const brandFr = Number(mobileMatch[1]);
    const nameFr = Number(mobileMatch[2]);
    expect(nameFr / brandFr).toBeCloseTo(1.5, 1);
  });

  test("BRAND cell wraps to 2 lines on mobile, single-line on desktop", () => {
    // line-clamp-2 (mobile) + md:line-clamp-none + md:truncate is the
    // canonical "wrap on small, truncate on large" combo.
    expect(SRC).toMatch(/line-clamp-2[^"]*md:line-clamp-none[^"]*md:truncate/);
  });

  test("desktop grid is unchanged (preserves the 9-col layout)", () => {
    // Sanity: don't accidentally narrow the desktop columns. The full
    // md: spec stays at 110px brand / 1fr line / 2fr name etc.
    expect(SRC).toContain(
      "md:grid-cols-[24px_110px_minmax(0,1fr)_minmax(0,2fr)_80px_24px_72px_36px_28px]",
    );
  });
});
