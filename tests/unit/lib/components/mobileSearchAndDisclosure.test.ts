/**
 * M2 — Navigation & IA: mobile search trigger + filter disclosure parity.
 *
 * Static source-scan net (mirrors buttonSweep / mobileHeader convention)
 * for the M2 acceptance:
 *
 *   - The mobile header carries a tap search trigger that dispatches the
 *     shared open-search event (recall-from-anywhere by touch); the
 *     near-zero-value "● ON" status pill was removed to reclaim width.
 *   - GlobalSearch listens for that event (keyboard parity unchanged).
 *   - The Library has an always-visible search field (`type="search"`).
 *   - The Library mobile Filters trigger is NOT cyan-filled (was
 *     variant="secondary"); it's a ghost outline with an active count.
 *   - Wishlist filters + the /user brand list are collapsed behind a
 *     disclosure on mobile.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("M2 — mobile search trigger", () => {
  const header = read("src/components/MobileHeader.tsx");
  const search = read("src/components/search/GlobalSearch.tsx");

  test("GlobalSearch exports + listens for the open-search event", () => {
    expect(search).toContain('export const OPEN_SEARCH_EVENT = "mm:open-search"');
    expect(search).toContain("addEventListener(OPEN_SEARCH_EVENT");
  });

  test("MobileHeader dispatches the open-search event from a labelled button", () => {
    expect(header).toContain('import { OPEN_SEARCH_EVENT }');
    expect(header).toContain("dispatchEvent(new Event(OPEN_SEARCH_EVENT))");
    expect(header).toContain('aria-label="Search"');
  });

  test('MobileHeader no longer renders the "● ON" status pill', () => {
    // The pill was an aria-label="Online" span — its removal reclaims
    // the scarce header width for the search trigger.
    expect(header).not.toContain('aria-label="Online"');
  });

  test("the search trigger meets the tap-target floor", () => {
    const idx = header.indexOf('aria-label="Search"');
    expect(idx).toBeGreaterThan(-1);
    const win = header.slice(Math.max(0, idx - 200), idx + 300);
    expect(win).toMatch(/tap-target/);
  });
});

describe("M2 — Library always-visible search + non-cyan Filters trigger", () => {
  const lib = read("src/components/library/LibraryPageClient.tsx");

  test("Library has an always-visible search input", () => {
    expect(lib).toContain('type="search"');
    expect(lib).toContain("LibrarySearchField");
  });

  test("the mobile Filters trigger is a ghost outline, not cyan secondary", () => {
    const idx = lib.indexOf('aria-label="Open filters"');
    expect(idx).toBeGreaterThan(-1);
    const win = lib.slice(Math.max(0, idx - 400), idx + 200);
    expect(win).toContain('variant="ghost"');
    expect(win).toContain('tone="outline"');
    expect(win).not.toContain('variant="secondary"');
  });

  test("the Filters trigger surfaces an active-filter count", () => {
    expect(lib).toContain("activeFilterCount");
    expect(lib).toContain("countActiveFilters");
  });
});

describe("M2 — filter disclosure parity (wishlist + user)", () => {
  const wishlist = read("src/components/wishlist/WishlistFilters.tsx");
  const userBrands = read("src/components/user/LibraryBrandFilterCard.tsx");

  test("wishlist filters collapse behind a mobile disclosure with a count", () => {
    expect(wishlist).toContain("aria-controls=\"wishlist-filter-body\"");
    expect(wishlist).toContain("activeCount");
    // The body is hidden on mobile until expanded, shown on lg+.
    expect(wishlist).toMatch(/mobileOpen \? "flex" : "hidden"/);
  });

  test("user brand list collapses behind a disclosure with a selected count", () => {
    expect(userBrands).toContain("aria-controls=\"brand-filter-list\"");
    expect(userBrands).toContain("listOpen");
  });
});

describe("M2 — countActiveFilters is shared, not duplicated", () => {
  const filters = read("src/lib/paints/filters.ts");
  const rail = read("src/components/library/FilterRail.tsx");

  test("countActiveFilters is exported from the filters lib", () => {
    expect(filters).toContain("export function countActiveFilters");
  });

  test("FilterRail imports it instead of redefining it", () => {
    expect(rail).toContain("countActiveFilters");
    expect(rail).toMatch(/import \{[^}]*countActiveFilters[^}]*\} from "@\/lib\/paints\/filters"/);
    // No local redefinition left behind.
    expect(rail).not.toContain("function countActiveFilters");
  });
});
