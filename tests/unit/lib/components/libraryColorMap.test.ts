/**
 * LIB-COLORMAP — the library page's right-hand collection colour map.
 *
 * Three layers, mirroring the heatSinkGridCell test style:
 *   1. Pure-logic tests for `nearestVisibleIndex` (the virtualised
 *      scroll-to-hue target resolver) — exact match, filtered-out hue
 *      fallback, empty-list guard.
 *   2. Source-scan tests pinning the panel contract: renders a canvas,
 *      lg-gated + hidden when a paint is selected, no cyan, token colours,
 *      and the live-dot overrides overlay wiring.
 *   3. Source-scan tests pinning the scroll-target wiring across
 *      LibraryPageClient / LibraryTable / LibraryGrid and the
 *      InventoryControls → overrides mirror.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import { nearestVisibleIndex } from "@/lib/library/scrollTarget";
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

/* ============================================================
   Layer 1 — nearestVisibleIndex (scroll-to-hue resolver)
   ============================================================ */

describe("nearestVisibleIndex (LIB-COLORMAP scroll-to-hue)", () => {
  const red = paint("red", "#ff0000");
  const green = paint("green", "#00ff00");
  const blue = paint("blue", "#0000ff");
  const list = [red, green, blue];

  test("returns the exact index when the paint is in the list", () => {
    expect(nearestVisibleIndex(list, "green")).toBe(1);
    expect(nearestVisibleIndex(list, "blue")).toBe(2);
  });

  test("returns -1 for an empty list", () => {
    expect(nearestVisibleIndex([], "red")).toBe(-1);
  });

  test("falls back to head (0) when filtered out and no target paint given", () => {
    expect(nearestVisibleIndex(list, "missing")).toBe(0);
  });

  test("falls back to the nearest in-list paint by hue when target is known", () => {
    // Target is a slightly-off red; the nearest hue in-list is red (idx 0).
    const offRed = paint("offRed", "#ff1010");
    const without = [green, blue]; // red filtered out
    // green is at 120deg, blue at 240deg — orange-red (~3deg) is closest to
    // green's 120? No: |hue gap| green=~117, blue=~237 → green wins.
    const idx = nearestVisibleIndex(without, "offRed", offRed);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(without.length);
    // green (0) is hue-nearest to a red among {green, blue}.
    expect(without[idx]?.id).toBe("green");
  });

  test("does not crash when the target paint is itself unparseable", () => {
    const bad = paint("bad", "not-a-hex");
    expect(() => nearestVisibleIndex([green, blue], "bad", bad)).not.toThrow();
  });
});

/* ============================================================
   Layer 2 — CollectionPanel contract (source-scan)
   ============================================================ */

describe("CollectionPanel — LIB-COLORMAP contract (source-scan)", () => {
  const src = read("src/components/library/CollectionPanel.tsx");

  test("renders the shared CollectionCanvas (the pixel spectrum)", () => {
    expect(src).toContain("CollectionCanvas");
    expect(src).toContain("<CollectionCanvas");
  });

  test("clicking a cell scrolls the list (onPickCell → onScrollToPaint), not a popup/select", () => {
    expect(src).toContain("onScrollToPaint");
    expect(src).toMatch(/onPickCell=\{handlePickCell\}/);
    expect(src).toMatch(/onScrollToPaint\(cell\.paint\.id\)/);
    // It must NOT open a detail / select a paint.
    expect(src).not.toContain("PaintDetailPanel");
    expect(src).not.toContain('params.set("paint"');
  });

  test("live dots: stateForPaint overlays the inventory overrides store", () => {
    expect(src).toContain("useInventoryOverrides");
    expect(src).toMatch(/overrides\?\.get\(paintId\)/);
    // Owned beats wanted beats none in the overlay.
    expect(src).toMatch(/snap\.ownedCount > 0[\s\S]*return "owned"/);
  });

  test("token colours only — no cyan, no raw hex in classNames", () => {
    expect(src).not.toContain("--color-cyan");
    const classNameHexes = src
      .split("className=")
      .slice(1)
      .map((chunk) => chunk.split("/>")[0] ?? chunk)
      .join("\n")
      .match(/#[0-9a-fA-F]{3,8}\b/g);
    expect(classNameHexes).toBeNull();
  });

  test("reuses the readout/filter helpers (copied, not the planner client)", () => {
    expect(src).toContain("coverageReadout");
    expect(src).toContain("formatCount");
    expect(src).toContain("filterCellsByBrands");
    // It does NOT import HeatSinkGridClient (markup copied per the spec).
    expect(src).not.toContain("HeatSinkGridClient");
  });

  test("LIB-COLORMAP-POLISH (1): the canvas fills the panel with bigger desktop pixels", () => {
    // Larger desktop cell floor + height-fill so the map occupies the
    // whole side panel instead of a small square.
    expect(src).toContain("DESKTOP_CELL_MIN_PX");
    expect(src).toMatch(/cellMinPx=\{DESKTOP_CELL_MIN_PX\}/);
    expect(src).toContain("fillHeight");
  });

  test("LIB-COLORMAP-POLISH (2): brand filter is a compact checkbox dropdown, not a chip row", () => {
    // The wrapping chip row is gone; a single trigger opens a checklist.
    expect(src).not.toContain("BrandChip");
    expect(src).toContain("BrandFilterDropdown");
    // Disclosure trigger + checkbox menu items.
    expect(src).toContain('aria-haspopup="menu"');
    expect(src).toContain('role="menuitemcheckbox"');
    expect(src).toMatch(/aria-checked=\{checked\}/);
    // Same multi-select behaviour wiring: toggle + "all" reset preserved.
    expect(src).toContain("onToggleBrand");
    expect(src).toContain("onSelectAll");
    // Outside-click + Escape close (SSR-safe disclosure pattern).
    expect(src).toContain('e.key === "Escape"');
  });

  test("LIB-COLORMAP-POLISH (2): the brand filter behaviour helpers are intact", () => {
    // Multi-select state + the null = "all brands" default are unchanged.
    expect(src).toContain("filterCellsByBrands");
    expect(src).toMatch(/selectedBrands === null/);
    expect(src).toContain("toggleBrand");
  });
});

/* ============================================================
   Layer 3 — page-level wiring (source-scan)
   ============================================================ */

describe("LibraryPageClient — colour-map mount + scroll wiring", () => {
  const src = read("src/components/library/LibraryPageClient.tsx");

  test("mounts the overrides provider so toggles + map share a store", () => {
    expect(src).toContain("InventoryOverridesProvider");
    expect(src).toContain("<InventoryOverridesProvider>");
  });

  test("the colour map is a persistent right column, hidden lg:flex", () => {
    expect(src).toContain("<CollectionPanel");
    expect(src).toContain("hidden lg:flex");
  });

  test("the map only renders when no paint is selected (detail overlay covers it)", () => {
    expect(src).toMatch(/selectedId === null &&[\s\S]*<CollectionPanel/);
  });

  test("holds a scrollTarget {paintId, nonce} bumped per map click", () => {
    expect(src).toContain("scrollTarget");
    expect(src).toMatch(/nonce:\s*\(prev\?\.nonce\s*\?\?\s*0\)\s*\+\s*1/);
  });

  test("passes the scroll target down to both the table and the grid", () => {
    expect(src).toMatch(/<LibraryTable[\s\S]*scrollNonce=\{scrollTarget\?\.nonce\}/);
    expect(src).toMatch(/<LibraryGrid[\s\S]*scrollNonce=\{scrollTarget\?\.nonce\}/);
  });
});

describe("LibraryTable — virtualised scroll-to-hue (source-scan)", () => {
  const src = read("src/components/library/LibraryTable.tsx");

  test("accepts scrollToPaintId + scrollNonce", () => {
    expect(src).toContain("scrollToPaintId");
    expect(src).toContain("scrollNonce");
  });

  test("on nonce change sets scrollTop = index * rowHeight (windowed jump)", () => {
    expect(src).toMatch(/targetIndex \* rowHeight/);
    expect(src).toMatch(/el\.scrollTop =/);
    // Re-runs on the nonce, not the paint id (repeat-click re-fire).
    expect(src).toMatch(/\[scrollNonce\]/);
  });

  test("uses the density-driven ROW_HEIGHT constants for the jump", () => {
    expect(src).toContain("ROW_HEIGHT_DESKTOP_COMFORTABLE");
    expect(src).toContain("ROW_HEIGHT_DESKTOP_COMPACT");
  });

  test("rows carry data-paint-id and flash transiently", () => {
    expect(src).toContain("data-paint-id={paint.id}");
    expect(src).toContain("flashPaintId");
    expect(src).toMatch(/flash &&/);
  });

  test("filtered-out picks fall back gracefully (nearestVisibleIndex)", () => {
    expect(src).toContain("nearestVisibleIndex");
  });
});

describe("LibraryGrid — scroll-to-hue (source-scan)", () => {
  const src = read("src/components/library/LibraryGrid.tsx");

  test("LibraryGrid got the same scroll treatment", () => {
    expect(src).toContain("scrollToPaintId");
    expect(src).toContain("scrollNonce");
    expect(src).toContain("data-paint-id={paint.id}");
    expect(src).toContain("scrollIntoView");
    expect(src).toContain("flashPaintId");
    expect(src).toContain("nearestVisibleIndex");
  });
});

describe("InventoryControls — mirrors optimistic state into the shared store", () => {
  const src = read("src/components/library/InventoryControls.tsx");

  test("calls the overrides set() in optimistic() and on revert", () => {
    expect(src).toContain("useInventoryOverrides");
    expect(src).toMatch(/overrides\?\.set\(paintId, next\)/);
    expect(src).toMatch(/overrides\?\.set\(paintId, prev\)/);
  });

  test("stays a no-op when no provider is mounted (optional consumer)", () => {
    // The hook returns null off the library page; the optional-chained
    // calls degrade to no-ops.
    const ctxSrc = read("src/components/library/inventoryOverrides.tsx");
    expect(ctxSrc).toMatch(/useContext\(InventoryOverridesContext\)/);
    expect(ctxSrc).toContain("InventoryOverridesValue | null");
  });
});
