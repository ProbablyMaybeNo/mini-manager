/**
 * UX-011 — Library touch-target floor (WCAG 2.2 §2.5.8, 24px minimum;
 * 44px touch zone on coarse pointers).
 *
 * Source-scan net: the affected controls live in two use-client virtualised
 * components, so we lock the hit-area tokens in source the same way the D3
 * suite does. The audit measured ~86 sub-24px interactive elements on the
 * library surface — row checkboxes, the select-all checkbox, filter-rail
 * checkbox label rows, the filter input, and the type/hue chips. The glyphs
 * stay native; the CLICKABLE wrapper is floored.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const read = (rel: string): string =>
  fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");

const TABLE = read("src/components/library/LibraryTable.tsx");
const RAIL = read("src/components/library/FilterRail.tsx");

describe("UX-011 — LibraryTable checkboxes get a tap-target wrapper", () => {
  test("the per-row select checkbox is wrapped in a tap-target label", () => {
    // A <label className="tap-target ...> spans the cell so the whole cell
    // toggles; the bare input keeps its native glyph size.
    expect(TABLE).toMatch(/<label className="tap-target[^"]*">[\s\S]*?type="checkbox"/);
    // The accessible name is preserved on the input.
    expect(TABLE).toMatch(/aria-label=\{`Select \$\{paint\.name\}`\}/);
  });

  test("the select-all checkbox is also wrapped in a tap-target label", () => {
    const fn = TABLE.slice(TABLE.indexOf("function SelectAllCheckbox"));
    expect(fn).toMatch(/<label className="tap-target/);
  });
});

describe("UX-011 — FilterRail interactive rows clear the 24px floor", () => {
  test("brand rows use the tap-target floor (no py-0.5 mis-tap target)", () => {
    const fn = RAIL.slice(RAIL.indexOf("function BrandRow"));
    expect(fn).toMatch(/"tap-target flex items-center gap-2 px-1 text-xs font-mono cursor-pointer"/);
    // The hit-area class must not carry a sub-24px py utility (ignore the
    // comment that explains the old value by stripping // lines first).
    const code = fn
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(code).not.toMatch(/py-0\.5/);
  });

  test("the line filter rows use the tap-target floor", () => {
    // The inline line-filter <label> sits in the Line section.
    expect(RAIL).toMatch(/"tap-target flex items-center gap-2 px-1 text-xs font-mono cursor-pointer"/);
  });

  test("the owned-only toggle uses the tap-target floor", () => {
    expect(RAIL).toMatch(/"tap-target flex items-center gap-2 text-xs font-mono cursor-pointer"/);
  });

  test("the search filter input is padded to py-2", () => {
    expect(RAIL).toMatch(/py-2 frame bg-\[var\(--color-bg-elevated\)\] font-mono text-sm/);
  });

  test("type/hue chips floor to min-h-[24px]", () => {
    expect(RAIL).toMatch(/px-2 py-1 min-h-\[24px\] text-2xs font-mono rounded-sm border/);
  });
});
