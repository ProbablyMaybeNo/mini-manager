/**
 * COLLECTIONS surface (batch/collections-rebuild).
 *
 * The /wishlist page was rebuilt + renamed to /collections: two tables
 * (PAINT COLLECTION + MODEL COLLECTION) driven off the `wishlist_item`
 * table partitioned by `kind`, with per-table filter buttons, vibrant
 * status selects, a paint→recipe column, and a bottom stats bar. These
 * source-snapshot tests pin the surface contract so a future re-skin
 * can't silently drop a required piece.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("Collections page", () => {
  const src = read("src/app/collections/page.tsx");

  test("renders both collection tables", () => {
    expect(src).toContain("<PaintCollectionTable");
    expect(src).toContain("<ModelCollectionTable");
  });

  test("both sections have their own per-table Filter button", () => {
    expect(src).toContain("<TableFilter");
    // Two filter instances — one per table.
    const count = src.split("<TableFilter").length - 1;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("the page title reads COLLECTIONS", () => {
    expect(src).toContain('title-display');
    expect(src).toMatch(/>COLLECTIONS</);
  });

  test("renders the bottom stats bar", () => {
    expect(src).toContain("<StatsBar");
  });

  test("partitions paint vs model via the dedicated collection queries", () => {
    expect(src).toContain("listPaintCollection");
    expect(src).toContain("listModelCollection");
  });
});

describe("Old /wishlist route redirects to /collections", () => {
  const src = read("src/app/wishlist/page.tsx");
  test("permanent redirect, no legacy table render", () => {
    expect(src).toContain('redirect("/collections")');
    expect(src).not.toContain("WishlistTable");
  });
});

describe("Paint collection table", () => {
  const src = read("src/components/collections/PaintCollectionTable.tsx");

  test("has the required paint columns incl. RECIPE + a small link cell", () => {
    for (const col of ["Name", "Company", "Vendor", "Cost", "Type", "Recipe", "Status", "Link"]) {
      expect(src).toContain(col);
    }
  });

  test("uses the vibrant StatusSelect with the paint status set", () => {
    expect(src).toContain("<StatusSelect");
    expect(src).toContain("paintCollectionStatuses");
  });

  test("name hyperlinks to the source URL + delete X present", () => {
    expect(src).toContain("<ItemName");
    expect(src).toContain("<DeleteButton");
    expect(src).toContain("<SourceLinkCell");
  });
});

describe("Model collection table", () => {
  const src = read("src/components/collections/ModelCollectionTable.tsx");

  test("has the required model columns incl. game / army / project", () => {
    for (const col of ["Name", "Game", "Army", "Price", "Project", "Status", "Link"]) {
      expect(src).toContain(col);
    }
  });

  test("project dropdown + full model status lifecycle wired", () => {
    expect(src).toContain("<ProjectSelect");
    expect(src).toContain("modelCollectionStatuses");
  });
});

describe("Navigation renamed Wishlist → Collections", () => {
  test("NavRail points at /collections", () => {
    const src = read("src/components/NavRail.tsx");
    expect(src).toContain('href: "/collections"');
    expect(src).toContain('label: "Collections"');
    expect(src).not.toContain('href: "/wishlist"');
  });

  test("BottomTabBar points at /collections", () => {
    const src = read("src/components/BottomTabBar.tsx");
    expect(src).toContain('href: "/collections"');
    expect(src).not.toContain('href: "/wishlist"');
  });
});
