/**
 * P13.7 — Match brand filter redesign. Ross flagged the old wrap of
 * 31 outlined cyan chips as "looks terrible, hard to read". New layout
 * is a multi-column grid with solid-fill green for active filters, per
 * P13.1 button discipline (no cyan, no `[ ]` brackets).
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

const src = read("src/components/tools/match/MatchClient.tsx");

describe("P13.7 — Brand filter is a responsive multi-column grid", () => {
  test("uses a CSS grid, not a flex-wrap", () => {
    // The new container is `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3`.
    expect(src).toMatch(
      /grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3[\s\S]{0,200}brands\.map/,
    );
  });

  test("the wrapping <div> exposes role='group' with aria-label", () => {
    expect(src).toMatch(/role="group"[\s\S]{0,80}aria-label="Brand filter"/);
  });

  test("does not use flex flex-wrap for the brand list (legacy pattern)", () => {
    // The legacy 'flex flex-wrap gap-1.5' wrapper around brands.map is gone.
    // Be careful: other flex-wrap calls may exist elsewhere in the file —
    // we only assert that brands.map is NOT inside a flex-wrap container.
    expect(src).not.toMatch(
      /flex flex-wrap gap-1\.5[\s\S]{0,80}brands\.map/,
    );
  });
});

describe("P13.7 — Active brand chip uses solid-fill green (P13.1 discipline)", () => {
  test("active state has bg-[var(--color-green)] with black text", () => {
    expect(src).toMatch(
      /active[\s\S]{0,400}bg-\[var\(--color-green\)\][\s\S]{0,80}text-black/,
    );
  });

  test("active state no longer uses cyan-tinted background", () => {
    // The old `bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]` is gone.
    expect(src).not.toContain(
      "bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]",
    );
  });

  test("inactive state uses bg-elevated + border-strong (solid panel feel)", () => {
    expect(src).toMatch(/bg-\[var\(--color-bg-elevated\)\][\s\S]{0,200}border-\[var\(--color-border-strong\)\]/);
  });
});

describe("P13.7 — Header carries readable count + Clear control", () => {
  test("header reads '<n> of <total>' when partial, 'all <total>' when none", () => {
    expect(src).toMatch(/\$\{brandFilter\.size\}\s*of\s*\$\{brands\.length\}/);
    expect(src).toMatch(/all\s*\$\{brands\.length\}/);
  });

  test("Clear control sits in the header row, not mixed into the chip wrap", () => {
    // The Clear is a text-only red button aligned to the header line.
    expect(src).toMatch(/Clear all brand filters/);
    expect(src).toMatch(/text-\[var\(--color-red\)\][\s\S]{0,100}Clear/);
  });
});

describe("P13.7 — No bracketed `[ ]` outline aesthetic in the filter block", () => {
  test("no legacy `[ Use ]` or `[ Clear ]` style remnant in the brand filter section", () => {
    // We grep only the brand-filter block: from "Brand filter" to the next
    // section delimiter. Cyan glow chips would have shown `[ ${b} ]` text.
    const start = src.indexOf("Brand filter");
    const end = src.indexOf("output={", start);
    const filterBlock = src.slice(start, end);
    expect(filterBlock).not.toMatch(/\[\s*\$\{b\}\s*\]/);
  });
});
