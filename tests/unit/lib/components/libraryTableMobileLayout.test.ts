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
  test("virtualiser sizes rows per breakpoint + density (D3)", () => {
    // D3 wired the desktop row height to the density lever (Comfortable 40
    // / Compact 32); mobile stays the 64px card.
    expect(SRC).toContain("const ROW_HEIGHT_DESKTOP_COMFORTABLE = 40");
    expect(SRC).toContain("const ROW_HEIGHT_DESKTOP_COMPACT = 32");
    expect(SRC).toContain("const ROW_HEIGHT_MOBILE = 64");
    expect(SRC).toContain(
      "const rowHeight = isMobile ? ROW_HEIGHT_MOBILE : desktopRowHeight",
    );
  });

  test("breakpoint is tracked via matchMedia at (max-width: 767px)", () => {
    expect(SRC).toContain('window.matchMedia("(max-width: 767px)")');
    expect(SRC).toContain("function useIsMobileLibrary");
  });

  test("PaintRow renders a stacked card on mobile (NAME on its own line)", () => {
    // UX-1506 — the layout is now WIDTH-gated CSS (max-md card / md grid) in
    // a single DOM rather than a JS `if (isMobile)` branch, so the dense
    // grid can never render on a phone before hydration. The card body is a
    // md:hidden flex-1 container that gives NAME its own full-width line.
    expect(SRC).toContain('<div className="md:hidden flex-1 min-w-0">');
    // The brittle JS-branch layout split is gone.
    expect(SRC).not.toMatch(/if \(isMobile\) \{[\s\S]*?return \(/);
  });

  test("D3 — desktop grid is name-first with a leading select column", () => {
    // D3 reordered to identifier-first (select / swatch / NAME / brand /
    // line / type / hex / own / wanted) and dropped SKU from the primary
    // table. Still 9 grid columns.
    expect(SRC).toContain(
      "md:grid-cols-[28px_24px_minmax(0,2fr)_110px_minmax(0,1fr)_24px_72px_36px_28px]",
    );
  });

  test("UX-1506 — the row is a CSS card below md, dense grid at md+ (no JS gate)", () => {
    // One DOM, two layouts, width-gated — correct on every viewport even
    // before the JS breakpoint syncs (the SSR-timing root cause).
    expect(SRC).toContain(
      "w-full max-w-full overflow-hidden flex items-center md:grid",
    );
    // The scroll container can never show a horizontal scrollbar.
    expect(SRC).toContain("overflow-y-auto overflow-x-hidden");
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
