/**
 * Round-16 fixes finished by the lead after the assigned agent hung on a
 * dev-server verification step (~44 min stall). Source-level sentinels, per
 * the repo convention for CSS/layout changes on use-client surfaces.
 *
 *   UX-1506 — /library overflowed at 375/768 (★ column off-screen) in BOTH
 *             grid + list views; the toggle cluster's ml-auto + the column's
 *             default min-width:auto pushed content past the viewport.
 *   UX-1502 — recipe step swatch + × delete tap boxes still collided.
 *   UX-1508 — CalendarMonthGrid computed `today` at render in a client
 *             component → server/client time could disagree → #418 on cold
 *             load.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");

describe("UX-1506 — /library no longer overflows (both views)", () => {
  test("the scroll column can collapse to the viewport (min-w-0 is load-bearing)", () => {
    const page = read("src/components/library/LibraryPageClient.tsx");
    expect(page).toContain("flex-1 min-w-0 min-h-0 flex flex-col");
  });

  test("the inventory toggle cluster is flex-none and drops ml-auto on mobile", () => {
    const table = read("src/components/library/LibraryTable.tsx");
    expect(table).toContain("flex items-center gap-1 flex-none md:contents");
    // The mobile ml-auto that nudged the 44px toggles past the clip box is gone.
    expect(table).not.toContain("shrink-0 ml-auto md:ml-0 md:contents");
  });
});

describe("UX-1502 — recipe slot grid is a responsive auto-fill grid", () => {
  // 2026-06-04 flatten: the cramped two-level StepRow (technique select +
  // swatch + × in one flex line) is gone. Slots are an auto-fill grid of
  // square cells, so the 375px swatch/× collision can't recur.
  const src = read("src/components/recipes/SlotList.tsx");

  test("slots render in an auto-fill grid of MUCH bigger cells (min-144px)", () => {
    // Item 1 (Ross redesign): the creator squares are MUCH bigger so the
    // paint name reads clearly in the centre with the layer along the
    // bottom edge — auto-fill min cell bumped 112px → 144px.
    expect(src).toContain(
      "grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(144px,1fr))]",
    );
  });

  test("each cell is a square with its own click + delete surfaces", () => {
    expect(src).toContain("w-full aspect-square");
  });
});

describe("UX-1508 — calendar 'today' is mounted-gated (no cold-load #418)", () => {
  const src = read("src/components/planner/CalendarMonthGrid.tsx");

  test("today is NOT computed during render", () => {
    expect(src).not.toContain("const today = todayUtcKey();");
  });

  test("today is state, set after mount in an effect", () => {
    expect(src).toContain("const [today, setToday] = useState<string | null>(null);");
    expect(src).toMatch(/useEffect\(\(\)\s*=>\s*\{\s*setToday\(todayUtcKey\(\)\);/);
  });
});
