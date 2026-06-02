/**
 * P16.3 — HeatSink grid view-pure helpers.
 *
 * Pins the border-token mapping (owned → green, wanted → amber,
 * none → transparent; @theme tokens only, never cyan / raw hex) and
 * the header readout formatting ("1,204 / 7,144 owned · 312 wanted").
 */
import { describe, expect, test } from "vitest";
import {
  COVERAGE_BORDER_CLASS,
  borderClassFor,
  coverageReadout,
  formatCount,
} from "@/components/planner/heatSinkHelpers";
import type { CoverageState, CoverageSummary } from "@/lib/paints/coverage";

describe("borderClassFor (P16.3)", () => {
  test("owned → green token border", () => {
    expect(borderClassFor("owned")).toBe("border-[var(--color-green)]");
  });

  test("wanted → amber token border", () => {
    expect(borderClassFor("wanted")).toBe("border-[var(--color-amber)]");
  });

  test("none → transparent border", () => {
    expect(borderClassFor("none")).toBe("border-transparent");
  });

  test("every coverage state has a border class", () => {
    const states: CoverageState[] = ["owned", "wanted", "none"];
    for (const s of states) {
      expect(COVERAGE_BORDER_CLASS[s]).toBeTruthy();
    }
  });

  test("no border class uses a raw hex or cyan", () => {
    for (const cls of Object.values(COVERAGE_BORDER_CLASS)) {
      expect(cls).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(cls).not.toContain("cyan");
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
