/**
 * R7-011 — disclosure caret tap-target floor.
 *
 * The auditor flagged the projects-dashboard row expander rendering as
 * a 20×20px button — under WCAG 2.5.8 Target Size (Minimum, ≥24×24).
 * The fix bumps the hit box to 36×36 and uses a single ▸ glyph that
 * rotates 90° on expand instead of swapping glyphs (cleaner motion,
 * one source of truth for the icon).
 *
 * Pins the new sizing + the rotation pattern so a future refactor
 * can't silently shrink the target back.
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

describe("ProjectsDashboardTable — R7-011 disclosure caret floor", () => {
  const src = read("src/components/ProjectsDashboardTable.tsx");

  test("expander button is 36×36 (w-9 h-9), beating WCAG 2.5.8's 24×24 floor", () => {
    // Find the disclosure button by its aria-label callback and check
    // the surrounding className.
    const idx = src.indexOf("`Expand ${row.name}`");
    expect(idx).toBeGreaterThan(0);
    const around = src.slice(Math.max(0, idx - 200), idx + 400);
    expect(around).toContain("w-9 h-9");
    // The old 20×20 (w-5 h-5) is gone on this button.
    expect(around).not.toContain("w-5 h-5");
  });

  test("empty 'no-children' spacer keeps the same 36×36 footprint", () => {
    // The "No children" spacer needs to align with siblings that DO
    // have children so the cascade lines stay straight. Match the
    // expander's new size, not the old 20px.
    const idx = src.indexOf('title="No children"');
    expect(idx).toBeGreaterThan(0);
    const before = src.slice(Math.max(0, idx - 200), idx);
    expect(before).toContain("w-9 h-9");
  });

  test("expander button carries aria-expanded reflecting the state", () => {
    expect(src).toContain("aria-expanded={expanded}");
  });

  test("caret uses a single rotating glyph (▸ rotates 90° on expand)", () => {
    // Single source of truth: ▸ stays put; CSS rotation gives the
    // state cue. The swap-glyph "▾ vs ▸" pattern is gone on this
    // button (the StepRow + NamedModelRow disclosures still swap
    // glyphs since they already meet the tap-target floor).
    expect(src).toContain('expanded ? "rotate-90" : "rotate-0"');
    // Verify the rotation transition is reduced-motion-aware.
    expect(src).toContain("motion-reduce:transition-none");
  });

  test("the rotation transition uses transition-transform", () => {
    expect(src).toContain("transition-transform");
  });

  test("docblock pins the WCAG 2.5.8 rationale", () => {
    expect(src).toContain("R7-011");
    expect(src).toContain("WCAG 2.5.8");
  });
});
