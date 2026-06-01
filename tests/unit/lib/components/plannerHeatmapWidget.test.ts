/**
 * P14.6 - PlannerHeatmapCell unit tests.
 *
 * Pure-helper coverage. The cell itself is an async server component;
 * data layer (getActivityByDay) is covered by
 * tests/integration/actions/activityLogQueries.test.ts.
 */
import { describe, expect, test } from "vitest";
import type { ActivityDay } from "@/db/queries/activityLog";
import {
  buildHeatmapCells,
  intensityFor,
  monthLabels,
  tooltipFor,
  type HeatmapCell,
} from "@/components/planner/plannerHeatmapHelpers";

function day(
  date: string,
  count: number,
  kinds: ReadonlyArray<ActivityDay["kinds"][number]> = ["stage_bump"],
): ActivityDay {
  return { date, count, kinds };
}

describe("intensityFor (P14.6)", () => {
  test("0 maps to 'none'", () => {
    expect(intensityFor(0)).toBe("none");
  });

  test("1 maps to 'low'", () => {
    expect(intensityFor(1)).toBe("low");
  });

  test("2-4 map to 'mid'", () => {
    expect(intensityFor(2)).toBe("mid");
    expect(intensityFor(3)).toBe("mid");
    expect(intensityFor(4)).toBe("mid");
  });

  test("5+ maps to 'high'", () => {
    expect(intensityFor(5)).toBe("high");
    expect(intensityFor(100)).toBe("high");
  });

  test("negative numbers degrade to 'none' (defensive)", () => {
    expect(intensityFor(-1)).toBe("none");
  });
});

describe("buildHeatmapCells (P14.6)", () => {
  const NOW = new Date("2026-06-01T12:00:00.000Z");

  test("emits exactly N cells for windowDays=N", () => {
    const cells = buildHeatmapCells([], NOW, 90);
    expect(cells).toHaveLength(90);
  });

  test("emits 30 cells for the mobile last-30 fallback", () => {
    const cells = buildHeatmapCells([], NOW, 30);
    expect(cells).toHaveLength(30);
  });

  test("the last cell is the 'now' day key (UTC)", () => {
    const cells = buildHeatmapCells([], NOW, 7);
    expect(cells[cells.length - 1]!.date).toBe("2026-06-01");
  });

  test("cells are emitted oldest-first", () => {
    const cells = buildHeatmapCells([], NOW, 3);
    expect(cells.map((c) => c.date)).toEqual([
      "2026-05-30",
      "2026-05-31",
      "2026-06-01",
    ]);
  });

  test("days with no activity get count 0 / intensity none", () => {
    const cells = buildHeatmapCells([], NOW, 3);
    for (const c of cells) {
      expect(c.count).toBe(0);
      expect(c.intensity).toBe("none");
    }
  });

  test("days with activity get the matching count + intensity bin", () => {
    const cells = buildHeatmapCells(
      [
        day("2026-06-01", 1),
        day("2026-05-31", 3),
        day("2026-05-30", 7),
      ],
      NOW,
      3,
    );
    expect(cells[0]).toMatchObject({ date: "2026-05-30", count: 7, intensity: "high" });
    expect(cells[1]).toMatchObject({ date: "2026-05-31", count: 3, intensity: "mid" });
    expect(cells[2]).toMatchObject({ date: "2026-06-01", count: 1, intensity: "low" });
  });

  test("days outside the window are dropped (window=3 doesn't keep day 4-back)", () => {
    const cells = buildHeatmapCells(
      [day("2026-05-25", 99)], // 7 days before NOW
      NOW,
      3,
    );
    expect(cells).toHaveLength(3);
    expect(cells.every((c) => c.count === 0)).toBe(true);
  });
});

describe("monthLabels (P14.6)", () => {
  test("emits one label per month change in the cell stream", () => {
    const cells: HeatmapCell[] = [
      { date: "2026-03-30", count: 0, intensity: "none" },
      { date: "2026-03-31", count: 0, intensity: "none" },
      { date: "2026-04-01", count: 0, intensity: "none" },
      { date: "2026-04-02", count: 0, intensity: "none" },
      { date: "2026-05-01", count: 0, intensity: "none" },
    ];
    const labels = monthLabels(cells);
    expect(labels).toEqual([
      { index: 0, label: "Mar" },
      { index: 2, label: "Apr" },
      { index: 4, label: "May" },
    ]);
  });

  test("first cell always gets a label even mid-month", () => {
    const cells: HeatmapCell[] = [
      { date: "2026-03-15", count: 0, intensity: "none" },
      { date: "2026-03-16", count: 0, intensity: "none" },
    ];
    expect(monthLabels(cells)).toEqual([{ index: 0, label: "Mar" }]);
  });

  test("empty input emits no labels", () => {
    expect(monthLabels([])).toEqual([]);
  });
});

describe("tooltipFor (P14.6 + UX-1107)", () => {
  // UX-1107 — tooltip vocabulary aligned with ACTIVITY widget +
  // activity_log schema. "actions" → "activities" / "activity" so the
  // painter reads the heatmap and the activity stream as one surface.
  test("0 activities uses the plural form", () => {
    expect(
      tooltipFor({ date: "2026-05-26", count: 0, intensity: "none" }),
    ).toBe("0 activities . Tue 26 May");
  });

  test("1 activity uses singular 'activity'", () => {
    expect(
      tooltipFor({ date: "2026-05-26", count: 1, intensity: "low" }),
    ).toBe("1 activity . Tue 26 May");
  });

  test("multiple activities use the plural form", () => {
    expect(
      tooltipFor({ date: "2026-05-26", count: 5, intensity: "high" }),
    ).toBe("5 activities . Tue 26 May");
  });

  test("Sunday boundary case (2026-06-07 is a Sunday)", () => {
    expect(
      tooltipFor({ date: "2026-06-07", count: 2, intensity: "mid" }),
    ).toBe("2 activities . Sun 7 Jun");
  });
});
