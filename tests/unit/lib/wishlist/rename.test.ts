/**
 * P11.4 — "Shopping for this" → "Wishlist" rename + yellow CTA.
 *
 * Pins the user-facing strings + the new pastel-yellow CTA modifier
 * so the project-detail wishlist panel keeps its visual + linguistic
 * identity after the Phase 11 sweep.
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

// P13.2 — ShoppingForThisPanel.tsx removed (project workspace
// simplification). The wishlist link is now a single button next to
// "+ Add unit" on the leaf workspace; the dedicated panel + its
// rename coverage block are retired.

describe("WishlistTable empty state — Shopping references retired (P11.4)", () => {
  const src = read("src/components/wishlist/WishlistTable.tsx");

  test("empty-state copy reads 'wishlist' not 'shopping list'", () => {
    expect(src).toContain("Nothing on your wishlist yet");
    expect(src).not.toContain("Nothing on your shopping list");
  });
});

describe("Wishlist page heading — microcopy refresh (P11.4)", () => {
  const src = read("src/app/wishlist/page.tsx");

  test("H1 still reads WISHLIST", () => {
    expect(src).toContain("WISHLIST");
  });

  test("subheading microcopy is plain prose, no internal milestone refs", () => {
    // Old copy mentioned "P2.5" — that's internal vocabulary leaking
    // into a user surface. Phase 11 retires it.
    // P12.12 — Phase-12 wishlist split updated the subheading to
    // "Paints and models you want to buy".
    expect(src).not.toContain("P2.5");
    expect(src).toMatch(/Paints and models you want to buy/);
  });
});

describe("Wishlist CTA on /projects/[id] (P11.4 → P13.10)", () => {
  // P11.4 introduced .btn-wishlist-cta as an outline-yellow modifier that
  // flipped a `variant="secondary"` Button to the wishlist palette.
  // P13.1 made `variant="warning"` solid-yellow with black text — the
  // canonical wishlist CTA. P13.10 retires the modifier and pins the
  // project workspace consumer onto `variant="warning"` directly.
  const css = read("src/app/globals.css");
  const projectPage = read("src/app/projects/[id]/page.tsx");

  test("legacy .btn-wishlist-cta CSS modifier is gone from globals", () => {
    expect(css).not.toMatch(/\.btn-wishlist-cta\s*\{/);
  });

  test("the project workspace's + Wishlist button uses variant='warning'", () => {
    // The button sits next to "+ Add unit" in the action button row.
    expect(projectPage).toMatch(/\+ Wishlist/);
    expect(projectPage).toMatch(/variant="warning"/);
    expect(projectPage).not.toMatch(/btn-wishlist-cta/);
  });
});
