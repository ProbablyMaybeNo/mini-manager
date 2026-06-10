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
  formatTimeTotal,
  padCount,
  activityTrendSeries,
  type KpiProject,
} from "@/components/dashboard/dashboardKpiHelpers";
import type { ActivityDay } from "@/db/queries/activityLog";

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

describe("formatTimeTotal (DASHBOARD-REDESIGN TIME TOTAL card)", () => {
  test("zero-padded HH:MM", () => {
    expect(formatTimeTotal(5 * 3600 + 47 * 60)).toBe("05:47");
  });

  test("pads minutes-only under an hour", () => {
    expect(formatTimeTotal(35 * 60)).toBe("00:35");
  });

  test("zero seconds -> 00:00", () => {
    expect(formatTimeTotal(0)).toBe("00:00");
  });

  test("negative clamps to 00:00", () => {
    expect(formatTimeTotal(-100)).toBe("00:00");
  });

  test("hours grow past two digits, never truncating", () => {
    expect(formatTimeTotal(120 * 3600 + 5 * 60)).toBe("120:05");
  });
});

describe("padCount (DASHBOARD-REDESIGN KPI big numbers)", () => {
  test("zero-pads small counts to two digits (mockup 05 / 03)", () => {
    expect(padCount(5)).toBe("05");
    expect(padCount(3)).toBe("03");
    expect(padCount(0)).toBe("00");
  });

  test("counts >= 100 render verbatim (no truncation)", () => {
    expect(padCount(100)).toBe("100");
    expect(padCount(123)).toBe("123");
  });

  test("clamps negatives to 00", () => {
    expect(padCount(-4)).toBe("00");
  });
});

describe("activityTrendSeries (PHASE-1 viz trend graph)", () => {
  // Anchor "today" in UTC so the YYYY-MM-DD keys are deterministic.
  const today = new Date("2026-06-06T12:00:00.000Z");
  const day = (date: string, count: number): ActivityDay => ({
    date,
    count,
    kinds: ["stage_bump"],
  });

  test("returns exactly `days` contiguous values, oldest -> newest", () => {
    const series = activityTrendSeries([], today, 7);
    expect(series).toHaveLength(7);
    expect(series.every((n) => n === 0)).toBe(true);
  });

  test("gap-fills quiet days with zeros and places counts chronologically", () => {
    const rows = [
      day("2026-06-06", 4), // today -> last slot
      day("2026-06-04", 2), // 2 days ago
    ];
    const series = activityTrendSeries(rows, today, 5);
    // Window days: 06-02, 06-03, 06-04, 06-05, 06-06
    expect(series).toEqual([0, 0, 2, 0, 4]);
  });

  test("ignores activity outside the window", () => {
    const rows = [day("2026-01-01", 9), day("2026-06-06", 1)];
    const series = activityTrendSeries(rows, today, 3);
    expect(series).toEqual([0, 0, 1]);
  });
});

describe("DASHBOARD-POLISH (fix #3) — redundant ACTIVITY-TREND panel removed", () => {
  // Ross flagged the bespoke activity-trend panel as a redundant section,
  // and the mockup carries no trend panel: the same activity signal is
  // already surfaced by the right-rail ACTIVITY tracker, and COMPLETION %
  // owns the output-rate readout in the KPI strip. The panel was dropped
  // from the dashboard (the DashboardTrendPanel component + the
  // activityTrendSeries helper stay in the tree, just unused by the page).
  const page = read("src/app/projects/page.tsx");

  test("the dashboard page no longer renders the trend panel", () => {
    expect(page).not.toContain("<DashboardTrendPanel");
    expect(page).not.toContain("DashboardTrendPanel");
  });

  test("the dashboard page no longer derives the trend series", () => {
    expect(page).not.toContain("activityTrendSeries");
  });
});

describe("DashboardKpiStrip component surface (DASHBOARD-REDESIGN)", () => {
  const src = read("src/components/dashboard/DashboardKpiStrip.tsx");

  test("renders a strip container with the data-kpi-strip marker", () => {
    expect(src).toContain("data-kpi-strip");
  });

  test("renders each KPI on the Card primitive with a big tabular-nums number", () => {
    expect(src).toContain("Card");
    expect(src).toContain("tabular-nums");
    // Mockup: a big CENTERED number — text-4xl on mobile, text-5xl at lg.
    expect(src).toContain("text-4xl");
    expect(src).toContain("text-5xl");
  });

  test("the big number is centered and carries the sanctioned glow", () => {
    expect(src).toContain("text-center");
    expect(src).toContain("glow-text-strong");
    expect(src).toContain("data-kpi-value");
  });

  test("cards are title + number ONLY (no dial / baseline / unit caption)", () => {
    // The redesigned strip drops the radial gauge, the baseline line, and
    // the unit caption — the mockup is a colour-coded title bar + number.
    expect(src).not.toContain("RadialGauge");
    expect(src).not.toContain("data-kpi-baseline");
    expect(src).not.toContain("card.dial");
  });

  test("each card is colour-coded (green / yellow / purple / cyan)", () => {
    expect(src).toContain("--color-green");
    expect(src).toContain("--color-yellow");
    expect(src).toContain("--color-purple-pastel");
    expect(src).toContain("--color-cyan");
  });

  test("UX-008 — KPI titles wrap (no truncation) at narrow widths", () => {
    // Pass titleClassName so "COMPLETION %" / "TIME TOTAL" wrap to two
    // lines instead of ellipsizing at 390px.
    expect(src).toMatch(/titleClassName="whitespace-normal/);
  });
});

describe("DASHBOARD page wires the KPI strip above the table", () => {
  const src = read("src/app/projects/page.tsx");

  test("imports + renders the DashboardKpiStrip", () => {
    expect(src).toContain("DashboardKpiStrip");
    expect(src).toContain("<DashboardKpiStrip");
  });

  test("ships the four locked KPI labels (mockup wording)", () => {
    expect(src).toContain("ACTIVE PROJECTS");
    expect(src).toContain("COMPLETION %");
    expect(src).toContain("STREAK");
    expect(src).toContain("TIME TOTAL");
  });

  test("derives metrics from existing data + helpers, no new tracking", () => {
    expect(src).toContain("activeProjectCount");
    expect(src).toContain("averageCompletion");
    expect(src).toContain("computeStreak");
    // TIME TOTAL is the lifetime session sum, not just this week.
    expect(src).toContain("getAllTimeRollupSeconds");
  });

  test("KPI strip renders before (above) the PROJECTS table", () => {
    expect(src.indexOf("<DashboardKpiStrip")).toBeLessThan(
      src.indexOf('title="PROJECTS"'),
    );
  });

  test("the four cards are colour-coded green / yellow / purple / cyan (mockup)", () => {
    expect(src).toContain('color: "green"');
    expect(src).toContain('color: "yellow"');
    expect(src).toContain('color: "purple"');
    expect(src).toContain('color: "cyan"');
  });
});
