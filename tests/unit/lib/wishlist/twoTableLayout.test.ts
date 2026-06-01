/**
 * P12.12 — /wishlist split into Models + Paints tables.
 *
 * Page reads `kind` column added in P12.11 and partitions items into
 * two sections rendered by the same WishlistTable component. The
 * slide-out detail drawer is gone per Ross's brief — inline editing
 * only.
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

describe("Wishlist page split (P12.12)", () => {
  const src = read("src/app/wishlist/page.tsx");

  test("partitions items by `kind` into modelItems + paintItems", () => {
    expect(src).toContain('items.filter((i) => i.kind === "model")');
    expect(src).toContain('items.filter((i) => i.kind === "paint")');
  });

  test("Models section renders before Paints section", () => {
    const modelsIdx = src.indexOf('aria-label="Models"');
    const paintsIdx = src.indexOf('aria-label="Paints"');
    expect(modelsIdx).toBeGreaterThan(0);
    expect(paintsIdx).toBeGreaterThan(modelsIdx);
  });

  test("each section has its own count + empty-state hint", () => {
    expect(src).toContain("Models · {modelItems.length}");
    expect(src).toContain("Paints · {paintItems.length}");
    expect(src).toContain("No model rows match");
    expect(src).toContain("No paint rows match");
  });

  test("WishlistDetailDrawer is gone (inline edit only)", () => {
    // The Drawer component is not imported + not rendered + no
    // selectedItemId state. (A docstring reference to the drawer
    // explaining the removal is fine — we only ban actual usage.)
    expect(src).not.toContain('import { WishlistDetailDrawer }');
    expect(src).not.toContain("<WishlistDetailDrawer");
    expect(src).not.toContain("selectedItemId");
  });

  test("the WishlistFilters status chip drives both tables", () => {
    // Each WishlistTable gets the same hasActiveFilters flag from the
    // single status param — partitioning happens inside the page.
    expect(src).toContain("<WishlistFilters");
    expect(src).toContain("modelItems");
    expect(src).toContain("paintItems");
  });
});

describe("setWishlistKind server action (P12.11/12)", () => {
  const src = read("src/lib/actions/wishlist.ts");

  test("exports setWishlistKind", () => {
    expect(src).toContain("export async function setWishlistKind");
  });

  test("validates kind against wishlistKinds enum", () => {
    expect(src).toContain("kindSchema");
    expect(src).toContain("kind: z.enum(wishlistKinds)");
  });

  test("scopes by owner", () => {
    expect(src).toMatch(/eq\(wishlistItems\.ownerId,\s*userId\)/);
  });
});
