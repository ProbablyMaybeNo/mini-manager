/**
 * DASH-KPI (2026-06-05) — top KPI strip on the DASHBOARD.
 *
 * Two halves:
 *   - Pure-helper coverage for the derivable metrics (active count,
 *     average completion, paint-time formatting). Node env, no db.
 *   - Source-sentinel coverage that the strip component + the page wire
 *     the four locked KPIs above the PROJECTS table (doc §14/§4/§8).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Project } from "@/db/schema";
import {
  activeProjectCount,
  averageCompletion,
  formatPaintTime,
  type KpiProject,
} from "@/components/dashboard/dashboardKpiHelpers";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

/** Build a KpiProject with sensible zeroed defaults; override per test. */
function proj(over: Partial<KpiProject>): KpiProject {
  return {
    parentId: null,
    count: 0,
    ownedCount: 0,
    buildCount: 0,
    primeCount: 0,
    paintCount: 0,
    baseCount: 0,
    completeCount: 0,
    isShelved: false,
    ...over,
  } satisfies Pick<
    Project,
    | "parentId"
    | "count"
    | "ownedCount"
    | "buildCount"
    | "primeCount"
    | "paintCount"
    | "baseCount"
    | "completeCount"
    | "isShelved"
  >;
}

describe("activeProjectCount", () => {
  test("counts a top-level project mid-stream (PAINTING)", () => {
    const ps = [proj({ count: 10, paintCount: 3, buildCount: 10 })];
    expect(activeProjectCount(ps)).toBe(1);
  });

  test("excludes child projects (parentId set) — armies count once", () => {
    const ps = [
      proj({ count: 10, paintCount: 3 }),
      proj({ parentId: "p1", count: 5, paintCount: 2 }),
    ];
    expect(activeProjectCount(ps)).toBe(1);
  });

  test("excludes shelved, complete, wishlist, and empty containers", () => {
    const ps = [
      proj({ count: 10, paintCount: 3, isShelved: true }),
      proj({ count: 10, completeCount: 10 }),
      proj({ count: 0 }), // wishlist / empty container
    ];
    expect(activeProjectCount(ps)).toBe(0);
  });

  test("zero projects -> 0", () => {
    expect(activeProjectCount([])).toBe(0);
  });
});

describe("averageCompletion", () => {
  test("averages progressPercent across model-bearing projects", () => {
    // count=10, buildCount=10 -> 10*20/10 = 20%. count=10, all-complete
    // -> 100%. Average = 60%.
    const ps = [
      proj({ count: 10, buildCount: 10 }),
      proj({
        count: 10,
        buildCount: 10,
        primeCount: 10,
        paintCount: 10,
        baseCount: 10,
        completeCount: 10,
      }),
    ];
    expect(averageCompletion(ps)).toBe(60);
  });

  test("excludes count===0 containers so they don't drag the average", () => {
    const ps = [
      proj({ count: 0 }), // container, excluded
      proj({
        count: 10,
        buildCount: 10,
        primeCount: 10,
        paintCount: 10,
        baseCount: 10,
        completeCount: 10,
      }),
    ];
    expect(averageCompletion(ps)).toBe(100);
  });

  test("no model-bearing projects -> 0", () => {
    expect(averageCompletion([proj({ count: 0 })])).toBe(0);
    expect(averageCompletion([])).toBe(0);
  });
});

describe("formatPaintTime", () => {
  test("hours + minutes", () => {
    expect(formatPaintTime(2 * 3600 + 47 * 60)).toEqual({
      value: "2h 47m",
      unit: "this week",
    });
  });

  test("minutes only when under an hour", () => {
    expect(formatPaintTime(35 * 60)).toEqual({
      value: "35m",
      unit: "this week",
    });
  });

  test("zero seconds -> 0m", () => {
    expect(formatPaintTime(0)).toEqual({ value: "0m", unit: "this week" });
  });

  test("negative clamps to 0m", () => {
    expect(formatPaintTime(-100)).toEqual({ value: "0m", unit: "this week" });
  });
});

describe("DashboardKpiStrip component surface", () => {
  const src = read("src/components/dashboard/DashboardKpiStrip.tsx");

  test("renders a strip container with the data-kpi-strip marker", () => {
    expect(src).toContain("data-kpi-strip");
  });

  test("renders each KPI on the Card primitive with a big tabular-nums number", () => {
    expect(src).toContain("Card");
    expect(src).toContain("tabular-nums");
    expect(src).toContain("text-3xl");
  });

  test("KPI numbers can take the sanctioned glow tier", () => {
    expect(src).toContain("glowClassName");
  });

  test("supports a third-context-layer baseline line (doc §8)", () => {
    expect(src).toContain("data-kpi-baseline");
  });
});

describe("DASHBOARD page wires the KPI strip above the table", () => {
  const src = read("src/app/projects/page.tsx");

  test("imports + renders the DashboardKpiStrip", () => {
    expect(src).toContain("DashboardKpiStrip");
    expect(src).toContain("<DashboardKpiStrip");
  });

  test("ships the four locked KPI labels", () => {
    expect(src).toContain("ACTIVE PROJECTS");
    expect(src).toContain("AVG COMPLETION");
    expect(src).toContain("STREAK");
    expect(src).toContain("PAINTING TIME");
  });

  test("derives metrics from existing data + helpers, no new tracking", () => {
    expect(src).toContain("activeProjectCount");
    expect(src).toContain("averageCompletion");
    expect(src).toContain("computeStreak");
    expect(src).toContain("getWeekRollupSeconds");
  });

  test("KPI strip renders before (above) the PROJECTS table", () => {
    expect(src.indexOf("<DashboardKpiStrip")).toBeLessThan(
      src.indexOf('title="PROJECTS"'),
    );
  });

  test("no cyan on the KPI numbers (cyan reserved for nav/CTA)", () => {
    // The strip value colours are fg / green / amber / muted — never cyan.
    expect(src).not.toContain('valueClassName: "text-[var(--color-cyan)]"');
  });
});
