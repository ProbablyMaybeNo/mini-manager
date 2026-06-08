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

describe("MobileHeader — terminal skin", () => {
  const src = read("src/components/MobileHeader.tsx");

  test("header carries the phosphor (cyan-tinted) bottom border", () => {
    expect(src).toMatch(
      /border-b border-\[color-mix\(in_srgb,var\(--color-cyan\)_22%,var\(--color-border\)\)\]/,
    );
  });

  test("active user pill lights cyan with the phosphor glow", () => {
    expect(src).toContain(
      "border-[var(--color-cyan)] text-[var(--color-cyan)] glow-cyan",
    );
  });

  test("avatar keeps the tap-target floor (mobile ≥44px)", () => {
    expect(src).toContain("tap-target");
  });
});

describe("BottomTabBar — terminal skin", () => {
  const src = read("src/components/BottomTabBar.tsx");

  test("bar carries the phosphor (cyan-tinted) top border", () => {
    expect(src).toMatch(
      /border-t border-\[color-mix\(in_srgb,var\(--color-cyan\)_22%,var\(--color-border\)\)\]/,
    );
  });

  test("active tab lights cyan with the phosphor glow (icon + label)", () => {
    expect(src).toContain("text-[var(--color-cyan)] glow-cyan");
  });

  test("active tab gets the cyan top-edge marker", () => {
    expect(src).toContain("border-t-[var(--color-cyan)]");
  });

  test("inactive tab hover tints cyan", () => {
    expect(src).toMatch(/group-hover:text-\[var\(--color-cyan\)\]/);
  });

  test("tab row keeps the ≥44px mobile tap floor (56px row)", () => {
    expect(src).toContain("min-h-[56px]");
  });

  test("FOCUS-FOLD — the standalone FOCUS tab is gone (folded into the dashboard)", () => {
    // FOCUS-FOLD (2026-06-08) — the standalone /planner (Focus) route was
    // removed and the painting bench folded into the /projects dashboard,
    // so there is no separate FOCUS tab on the mobile bar.
    expect(src).not.toContain('href: "/planner"');
    expect(src).not.toMatch(/label:\s*"Focus"/);
    // The five remaining primary sections are all present.
    for (const href of [
      "/projects",
      "/library",
      "/recipes",
      "/tools",
      "/collections",
    ]) {
      expect(src).toContain(`href: "${href}"`);
    }
  });
});
