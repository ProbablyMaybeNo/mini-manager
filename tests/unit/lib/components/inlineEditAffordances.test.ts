/**
 * P11.6 — Inline editing affordance sweep.
 *
 * Pins the visible-affordance contract for "click to change" cells
 * across the app. We check source files for the markers (chevron
 * glyph, aria-haspopup, hover class) rather than rendering — most of
 * these components are `'use client'` with server-action imports.
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

describe("Recipe attached-project link — clickability affordance (P11.6)", () => {
  const src = read("src/components/recipes/RecipeHeader.tsx");

  test("attached pill shows a trailing arrow glyph when href is set", () => {
    expect(src).toContain("Attached · {attachment.label} →");
  });

  test("wrapping anchor carries an accessible aria-label", () => {
    expect(src).toMatch(/aria-label=\{`Open \$\{attachment\.label\} workspace`\}/);
  });

  test("anchor has a visible hover-tint class for affordance", () => {
    // Tailwind 4 keeps the literal space in `color-mix(in srgb, …)` —
    // accept either spelling for resilience.
    expect(src).toMatch(/hover:bg-\[color-mix\(in[_\s]srgb,var\(--color-cyan\)/);
  });

  test("StatusPill inside the anchor carries cursor-pointer", () => {
    expect(src).toContain('className="cursor-pointer"');
  });
});

describe("Collections Project column — ProjectSelect chevron", () => {
  const src = read("src/components/collections/ProjectSelect.tsx");

  test("uses lucide ChevronDown icon (not a bracket glyph)", () => {
    expect(src).toContain("ChevronDown");
  });

  test("button declares aria-haspopup so screen-readers announce edit affordance", () => {
    expect(src).toContain("aria-haspopup");
  });

  test("hover state flips the border to the cyan accent token", () => {
    expect(src).toContain("hover:border-[var(--color-cyan)]");
  });
});

describe("Collections Status column — StatusSelect affordance", () => {
  const src = read("src/components/collections/StatusSelect.tsx");

  test("pill renders a trailing chevron `▾` when interactive", () => {
    expect(src).toContain("{status} ▾");
  });

  test("button declares aria-haspopup='menu' for keyboard parity", () => {
    expect(src).toContain('aria-haspopup="menu"');
  });

  test("supports keyboard escape to close the popover", () => {
    expect(src).toMatch(/Escape/);
  });
});

describe("Library inventory toggle — clear hover affordance (P11.6)", () => {
  const src = read("src/components/library/InventoryControls.tsx");

  test("owned ✓/○ toggle has a hover-tint to green when off", () => {
    expect(src).toMatch(/hover:text-\[var\(--color-green\)\]/);
  });

  test("wish ★/☆ toggle has a hover-tint to yellow when off", () => {
    expect(src).toMatch(/hover:text-\[var\(--color-yellow\)\]/);
  });

  test("each toggle exposes a descriptive aria-label that flips by state", () => {
    expect(src).toContain('"Mark as not owned"');
    expect(src).toContain('"Mark as owned"');
    // UX-1001 — renamed from "Add to wishlist" / "Remove from wishlist"
    // to disambiguate from the /wishlist page (kit/box purchase queue).
    expect(src).toContain('"Mark as wanted"');
    expect(src).toContain('"Unmark"');
  });

  test("UX-1001: wanted-star toggle exposes the disambiguation tooltip", () => {
    // The two-system naming clash was the source of confusion: the
    // library star and the /wishlist page both spoke "wishlist" but
    // tracked disjoint data. The tooltip locks the explanation.
    expect(src).toContain("Different from the Wishlist page");
  });
});

// P13.4 — the "NamedModel recipe-override toggle" coverage block is
// gone since NamedModelRow.tsx + the entire named-model entity were
// removed (PHASE13_PLAN.md). Recipe attachments live on projects now.
