/**
 * batch/redesign-nav — terminal-language nav chrome sentinels.
 *
 * Pins the vintage-terminal re-skin invariants on the persistent nav
 * surfaces so a future change can't silently drop the active-route cyan
 * phosphor cue or the phosphor edge back to the old neutral
 * `--color-accent`/grey treatment. These are source-string sentinels (the
 * project's established pattern for chrome styling) — they assert the
 * design tokens are wired, not pixels.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("NavRail — terminal command-column skin", () => {
  const src = read("src/components/NavRail.tsx");

  test("rail shell carries the phosphor (cyan-tinted) right-edge border", () => {
    expect(src).toMatch(
      /border-r border-\[color-mix\(in_srgb,var\(--color-cyan\)_22%,var\(--color-border\)\)\]/,
    );
  });

  test("rail fill is near-black, never grey", () => {
    expect(src).toContain("bg-[var(--color-bg-elevated)]");
  });

  test("active route lights cyan with the phosphor glow", () => {
    expect(src).toContain("text-[var(--color-cyan)] glow-cyan");
  });

  test("active route gets the cyan left-edge marker", () => {
    expect(src).toContain("border-l-[var(--color-cyan)]");
  });

  test("hover tints cyan (not the old neutral fg tint)", () => {
    expect(src).toMatch(/group-hover:text-\[var\(--color-cyan\)\]/);
  });
});
