/**
 * UX-1215 (supersedes UX-910) — Library mobile layout.
 *
 * UX-910 originally rebalanced the dense mobile grid so long NAMEs were
 * less crowded, but on 375px viewports NAME still truncated to ambiguity
 * ("3b Au …"). UX-1215 replaces the mobile grid with a stacked CARD
 * layout: NAME on its own full-width line, brand · type · hex beneath,
 * toggles pinned right. The virtualiser sizes rows numerically per
 * breakpoint (40px desktop / 64px mobile) via matchMedia.
 *
 * Source-string assertions: LibraryTable.tsx is a use-client virtualised
 * grid, so we lock the layout tokens rather than render-test it.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = fs.readFileSync(
  path.resolve(__dirname, "../../../../src/components/library/LibraryTable.tsx"),
  "utf-8",
);

describe("LibraryTable mobile card layout (UX-1215)", () => {
  test("virtualiser sizes rows per breakpoint (40px desktop / 64px mobile)", () => {
    expect(SRC).toContain("const ROW_HEIGHT_DESKTOP = 40");
    expect(SRC).toContain("const ROW_HEIGHT_MOBILE = 64");
    expect(SRC).toContain(
      "const rowHeight = isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP",
    );
  });

  test("breakpoint is tracked via matchMedia at (max-width: 767px)", () => {
    expect(SRC).toContain('window.matchMedia("(max-width: 767px)")');
    expect(SRC).toContain("function useIsMobileLibrary");
  });

  test("PaintRow renders a stacked card on mobile (NAME on its own line)", () => {
    // The mobile branch is a flex card, not the dense grid.
    expect(SRC).toMatch(/if \(isMobile\) \{[\s\S]*?return \(/);
    // NAME gets a full-width flex-1 container so it never truncates to
    // ambiguity against a sibling column.
    expect(SRC).toContain('<div className="flex-1 min-w-0">');
  });

  test("desktop grid is unchanged (preserves the 9-col layout)", () => {
    expect(SRC).toContain(
      "md:grid-cols-[24px_110px_minmax(0,1fr)_minmax(0,2fr)_80px_24px_72px_36px_28px]",
    );
  });

  test("the old mobile grid columns + line-clamp brand wrap are gone", () => {
    // UX-910's mobile grid spec and the 2-line brand clamp are replaced
    // by the card layout.
    expect(SRC).not.toContain(
      "grid-cols-[24px_minmax(0,1fr)_minmax(0,1.5fr)_24px_60px_36px_28px]",
    );
    expect(SRC).not.toContain("line-clamp-2");
  });

  test("the column header strip is hidden below md (card is self-labelling)", () => {
    expect(SRC).toContain("hidden md:grid items-center gap-3 px-3 py-1.5");
  });
});
