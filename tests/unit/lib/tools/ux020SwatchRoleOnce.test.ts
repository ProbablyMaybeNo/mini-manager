/**
 * UX-020 — the Colour Wheel's RECIPE COLOURS rows must show the slot role
 * ONCE, not the duplicate "PRIMARY · PRIMARY" the audit flagged.
 *
 * The row label already carries the role ("Primary" for the lead swatch,
 * "Swatch N" otherwise) from WheelClient's swatchLabel(), so SwatchActions
 * must NOT also append a "· primary" suffix. Source-sentinel only (matches
 * the codebase pattern for chrome/label sweeps).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("UX-020 — wheel swatch role shown once", () => {
  const src = read("src/components/tools/wheel/SwatchActions.tsx");

  test("does NOT append a duplicate '· primary' suffix to the label", () => {
    expect(src).not.toContain('" · primary"');
  });

  test("still renders the role label + the orthogonal pinned state cue", () => {
    expect(src).toContain("{label}");
    expect(src).toContain('" · pinned"');
  });

  test("isPrimary is still used (the lead swatch keeps its accent border)", () => {
    expect(src).toMatch(/isPrimary && "border-\[var\(--color-accent\)\]"/);
  });
});
