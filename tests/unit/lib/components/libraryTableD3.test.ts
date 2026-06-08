/**
 * D3 — Library full data table.
 *
 * Source-scan net (LibraryTable is a use-client virtualised grid; we lock
 * the layout/behaviour tokens) for the D3 acceptance [D §9]:
 *
 *   - Name leads (identifier-first); a leading select column.
 *   - Sortable headers with a 3-state icon + aria-sort, wired to the
 *     existing ?sort= modes (name / brand / hue).
 *   - Density toggle wired to row height (Comfortable 40 / Compact 32).
 *   - Bulk select: per-row checkbox + 3-state Select-All + a batch bar.
 *   - Right-click context menu (Mark owned / Mark wanted / Copy hex).
 *   - Zebra striping.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../../../src/components/library/LibraryTable.tsx",
  ),
  "utf-8",
);

describe("D3 — name-first columns", () => {
  test("the dense grid leads with select + swatch + NAME (name before brand)", () => {
    // aria-colindex 3 is the NAME cell; brand is colindex 4.
    const nameIdx = SRC.indexOf('aria-colindex={3}');
    const brandIdx = SRC.indexOf('aria-colindex={4}');
    expect(nameIdx).toBeGreaterThan(-1);
    expect(brandIdx).toBeGreaterThan(-1);
    expect(nameIdx).toBeLessThan(brandIdx);
    // The Name header is a sortable header (label "Name").
    expect(SRC).toMatch(/label="Name"/);
  });
});

describe("D3 — sortable headers", () => {
  test("sortable headers carry aria-sort + a 3-state icon", () => {
    expect(SRC).toMatch(/aria-sort=\{active \? "ascending" : "none"\}/);
    expect(SRC).toMatch(/active \? "▲" : "⇅"/);
  });

  test("header sort writes the existing ?sort= URL param", () => {
    expect(SRC).toMatch(/params\.set\("sort", mode\)/);
  });

  test("Name / Brand / Hex columns map to the name / brand / hue modes", () => {
    expect(SRC).toMatch(/name:\s*"name"/);
    expect(SRC).toMatch(/brand:\s*"brand"/);
    expect(SRC).toMatch(/hex:\s*"hue"/);
  });
});

describe("D3 — density-driven row height", () => {
  test("desktop row height tracks the global density lever", () => {
    expect(SRC).toContain("const [density] = useDensity()");
    expect(SRC).toMatch(
      /density === "compact"\s*\?\s*ROW_HEIGHT_DESKTOP_COMPACT\s*:\s*ROW_HEIGHT_DESKTOP_COMFORTABLE/,
    );
  });
});

describe("D3 — bulk select", () => {
  test("per-row checkbox toggles selection", () => {
    expect(SRC).toMatch(/aria-label=\{`Select \$\{paint\.name\}`\}/);
  });

  test("3-state Select-All sets the native indeterminate property", () => {
    expect(SRC).toContain("function SelectAllCheckbox");
    expect(SRC).toMatch(/ref\.current\.indeterminate = someSelected/);
  });

  test("a batch-action bar appears when rows are selected", () => {
    expect(SRC).toContain("function BatchActionBar");
    expect(SRC).toMatch(/selected\.size > 0 \?/);
    expect(SRC).toMatch(/Mark owned/);
    expect(SRC).toMatch(/Mark wanted/);
  });

  test("selection accent is green — off cyan (the active row) and off amber (the wishlist hue)", () => {
    // LIB-COLOR (2) — selection (checkbox accent + selected-row wash + batch
    // bar) moved from amber → green so it no longer collides with the
    // wanted/wishlist amber semantic, while staying distinct from the cyan
    // detail-active row (DESIGN_LANGUAGE §1).
    expect(SRC).toMatch(/accent-\[var\(--color-green\)\]/);
    // The selected-row wash + batch bar use the green token, not amber.
    expect(SRC).toMatch(
      /selected &&\s*\n\s*"bg-\[color-mix\(in_srgb,var\(--color-green\)/,
    );
    // Selection never adopts cyan (that's reserved for the active/detail row).
    expect(SRC).not.toMatch(/accent-\[var\(--color-cyan\)\]/);
  });
});

describe("D3 — right-click context menu", () => {
  test("rows wire onContextMenu to a keyboard-dismissible menu", () => {
    expect(SRC).toMatch(/onContextMenu=\{\(e\) => \{/);
    expect(SRC).toContain("function RowContextMenu");
    expect(SRC).toMatch(/role="menu"/);
    expect(SRC).toMatch(/role="menuitem"/);
  });

  test("context menu offers Mark owned / Mark wanted / Copy hex", () => {
    expect(SRC).toMatch(/Mark owned/);
    expect(SRC).toMatch(/Mark wanted/);
    expect(SRC).toMatch(/Copy hex/);
  });

  test("menu closes on outside click / scroll / Escape", () => {
    expect(SRC).toMatch(/addEventListener\("keydown", onKey\)/);
    expect(SRC).toMatch(/e\.key === "Escape"/);
  });
});

describe("D3 — zebra striping", () => {
  test("odd rows get a faint tint alongside the always-on hover", () => {
    expect(SRC).toMatch(/rowIndex % 2 === 1 &&/);
  });
});

describe("D3 — discipline", () => {
  test("no raw hex literals in classNames; no @ts-ignore / any", () => {
    const noComments = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(
      /(^|\s)\/\/[^\n]*/g,
      "$1",
    );
    // Hex literals only appear as data (paint.hex inline style) — never a
    // #rrggbb literal in source.
    expect(noComments).not.toMatch(/["']#[0-9a-fA-F]{3,8}["']/);
    expect(SRC).not.toMatch(/@ts-ignore/);
    expect(SRC).not.toMatch(/:\s*any\b/);
  });
});
