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

  // P15.2 — touch-target sweep replaced the bespoke min-h-[28px] with the
  // shared `tap-target` utility (44px mobile / 32px desktop per globals.css)
  // so the segmented sub-buttons clear the Apple-HIG touch floor on phones
  // while staying tight on the dense desktop toolbar.
  test("compact size — px-3 padding + tap-target touch floor", () => {
    expect(src).toContain("px-3");
    expect(src).toContain("tap-target");
    // The bespoke 28px floor is gone — sizing is now centralised.
    expect(src).not.toContain("min-h-[28px]");
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

describe("Library filter trigger (FIGMA-REBUILD §4)", () => {
  const src = read("src/components/library/LibraryPageClient.tsx");

  // FIGMA-REBUILD §4 — the old rail-on-desktop / floating-button-on-mobile
  // split was unified: ONE Filter button opens the FILTER SlideOutPanel on
  // every breakpoint. The bespoke `setMobileFilterOpen` / "Open filters" /
  // "Close filters" plumbing is gone; the SlideOutPanel primitive owns the
  // close button + backdrop-click close.
  test("a single Filter button opens the filter panel on every breakpoint", () => {
    expect(src).toContain("setFilterOpen(true)");
    expect(src).not.toContain("setMobileFilterOpen");
    expect(src).not.toContain('aria-label="Open filters"');
  });

  test("the filter panel renders FilterRail with disableCollapse", () => {
    expect(src).toContain("disableCollapse");
  });

  test("the unified FILTER SlideOutPanel owns the close + backdrop", () => {
    // The page mounts the shared SlideOutPanel (Esc / backdrop / × close,
    // role=dialog) instead of a bespoke drawer.
    expect(src).toContain("<SlideOutPanel");
    expect(src).toContain('title="FILTER"');
    expect(src).toContain("onClose={() => setFilterOpen(false)}");
  });
});
