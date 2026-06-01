/**
 * P12.20 — Library polish: view-toggle spacing + filter button.
 *
 * The List / Grid buttons in the view-mode toggle felt too tight in
 * the Phase 11 audit; P12.20 bumps padding (px-4 → px-5), gap (2 → 2.5),
 * and min-height (32 → 36) so the bank reads as a real terminal-button
 * row. The mobile filter trigger already exists; we pin it here so a
 * future regression can't quietly remove it.
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

describe("ViewModeToggle — terminal_ui INIT/SAVE/PAUSE button style", () => {
  const src = read("src/components/library/ViewModeToggle.tsx");

  // Round-7 (2026-06-01) — Ross feedback: the two buttons were too
  // close together and joined as a segmented group. New design is two
  // standalone bordered buttons with a gap between them, yellow as the
  // selector semantic (cyan-buttons-discipline lock).
  test("buttons sit separately (gap), not joined as a segmented group", () => {
    expect(src).toContain("gap-2");
    expect(src).not.toContain("border border-[var(--color-border-strong)] rounded-sm overflow-hidden");
  });

  test("compact size — px-3 padding + min-h-[28px] tap floor", () => {
    expect(src).toContain("px-3");
    expect(src).toContain("min-h-[28px]");
  });

  test("active state uses yellow-filled with dark text (no cyan)", () => {
    expect(src).toContain("bg-[var(--color-yellow)]");
    expect(src).toContain("text-[var(--color-bg)]");
    // Cyan banished from buttons per Ross's Round-7 discipline.
    expect(src).not.toContain("bg-[var(--color-accent)]");
  });

  test("ToggleButton has aria-pressed wired for screen readers", () => {
    expect(src).toContain("aria-pressed={active}");
  });
});

describe("Library mobile filter trigger", () => {
  const src = read("src/components/library/LibraryPageClient.tsx");

  test("the mobile-only Filters button exists and is hidden on desktop", () => {
    // md:hidden + aria-label="Open filters" + setMobileFilterOpen(true).
    expect(src).toContain('aria-label="Open filters"');
    expect(src).toContain("md:hidden fixed top-14 right-3");
    expect(src).toContain("setMobileFilterOpen(true)");
  });

  test("the mobile filter drawer renders FilterRail with disableCollapse", () => {
    expect(src).toContain("disableCollapse");
  });

  test("drawer has a close button + backdrop-click close", () => {
    expect(src).toContain('aria-label="Close filters"');
    expect(src).toContain("setMobileFilterOpen(false)");
  });
});
