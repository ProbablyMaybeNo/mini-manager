/**
 * P16.3 / P17 — HeatSink grid view-pure helpers.
 *
 * Pins the OVERLAY-DOT token mapping (owned → green dot, wanted → yellow
 * dot, none → no dot; @theme tokens only, never cyan / raw hex) and the
 * header readout formatting ("1,204 / 7,144 owned · 312 wanted").
 *
 * P17 redesign: ownership is marked by an overlaid dot, NOT a coloured
 * border. The unowned pixels carry no dot at all — they are the gamut map.
 */
import { describe, expect, test } from "vitest";
import {
  COVERAGE_DOT_CLASS,
  coverageReadout,
  dotClassFor,
  formatCount,
} from "@/components/planner/heatSinkHelpers";
import type { CoverageState, CoverageSummary } from "@/lib/paints/coverage";

describe("dotClassFor (P17 overlay dot)", () => {
  test("owned → green dot fill token", () => {
    expect(dotClassFor("owned")).toBe("bg-[var(--color-green)]");
  });

  test("wanted → yellow dot fill token", () => {
    expect(dotClassFor("wanted")).toBe("bg-[var(--color-yellow)]");
  });

  test("none → no dot (null), so the bare spectrum pixel shows through", () => {
    expect(dotClassFor("none")).toBeNull();
  });

  test("owned + wanted have a dot class; none does not", () => {
    expect(COVERAGE_DOT_CLASS.owned).toBeTruthy();
    expect(COVERAGE_DOT_CLASS.wanted).toBeTruthy();
    expect(COVERAGE_DOT_CLASS.none).toBeNull();
  });

  test("the dot uses green for owned, yellow for wishlist (not amber)", () => {
    expect(COVERAGE_DOT_CLASS.owned).toContain("--color-green");
    expect(COVERAGE_DOT_CLASS.wanted).toContain("--color-yellow");
    // Not the old amber border colour — wishlist dots are yellow now.
    expect(COVERAGE_DOT_CLASS.wanted).not.toContain("--color-amber");
  });

  test("no dot class uses a raw hex, cyan, or a border token", () => {
    const states: CoverageState[] = ["owned", "wanted", "none"];
    for (const s of states) {
      const cls = COVERAGE_DOT_CLASS[s];
      if (cls === null) continue;
      expect(cls).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(cls).not.toContain("cyan");
      // The marker is a dot fill, not a coloured ownership border.
      expect(cls).not.toContain("border-");
    }
  });
});

describe("formatCount (P16.3)", () => {
  test("groups thousands with commas", () => {
    expect(formatCount(1204)).toBe("1,204");
    expect(formatCount(7144)).toBe("7,144");
  });

  test("leaves small numbers bare", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(312)).toBe("312");
  });
});

describe("coverageReadout (P16.3)", () => {
  const summary = (over: Partial<CoverageSummary>): CoverageSummary => ({
    owned: 0,
    wanted: 0,
    total: 0,
    ownedPct: 0,
    ...over,
  });

  test("formats the locked header string with grouped counts", () => {
    expect(
      coverageReadout(summary({ owned: 1204, total: 7144, wanted: 312 })),
    ).toBe("1,204 / 7,144 owned · 312 wanted");
  });

  test("zeroed collection reads cleanly", () => {
    expect(coverageReadout(summary({ owned: 0, total: 7144, wanted: 0 }))).toBe(
      "0 / 7,144 owned · 0 wanted",
    );
  });
});
