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

describe("ShoppingForThisPanel — wishlist rename (P11.4)", () => {
  const src = read("src/components/wishlist/ShoppingForThisPanel.tsx");

  test("Card title reads 'Wishlist · N' not 'Shopping for this · N'", () => {
    expect(src).toContain("Wishlist · ");
    expect(src).not.toContain("Shopping for this · ");
  });

  test("uses yellow accent on the Card chrome", () => {
    expect(src).toContain('accentColor="yellow"');
  });

  test("renders the `+ Add to wishlist` CTA at the panel header", () => {
    expect(src).toContain("+ Add to wishlist");
    expect(src).toContain("btn-wishlist-cta");
  });

  test("empty-state copy uses plain-prose wishlist language", () => {
    expect(src).toMatch(/Paints, kits, or tools you want for this project/);
  });
});

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

describe("btn-wishlist-cta CSS modifier (P11.4)", () => {
  const css = read("src/app/globals.css");

  test("CSS class is defined in globals", () => {
    expect(css).toMatch(/\.btn-wishlist-cta\s*\{/);
  });

  test("flips the secondary button to the pastel-yellow palette token", () => {
    expect(css).toMatch(
      /\.btn-wishlist-cta\s*\{[\s\S]*?color:\s*var\(--color-yellow\)/,
    );
    expect(css).toMatch(
      /\.btn-wishlist-cta\s*\{[\s\S]*?border-color:\s*var\(--color-yellow\)/,
    );
  });
});
