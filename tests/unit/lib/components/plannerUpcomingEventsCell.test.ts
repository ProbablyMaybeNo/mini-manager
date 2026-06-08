/**
 * DASHBOARD-POLISH (fix #4) — the right-rail EVENTS section.
 *
 * Ross's mockup shows the rail as PLANNER calendar → EVENTS → ACTIVITY.
 * The EVENTS section was the missing piece; it reuses the SAME `events`
 * table the calendar reads (listUpcomingEvents), surfaced as a flat
 * upcoming agenda — no new backend.
 *
 * The cell is a DB-bound async server component, so (like the rest of the
 * dashboard's cell tests) we cover the pure relative-day helpers by import
 * and pin the wiring via source sentinels. The query itself is covered in
 * tests/integration/actions/events.test.ts.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  dayDiff,
  relativeDay,
  startOfUtcDay,
} from "@/components/planner/plannerUpcomingEventsHelpers";

const ROOT = path.resolve(__dirname, "../../../../");
const read = (rel: string) => fs.readFileSync(path.resolve(ROOT, rel), "utf-8");

describe("dayDiff — whole UTC-calendar-day difference", () => {
  test("same day (different wall-clock times) is 0", () => {
    expect(
      dayDiff(
        new Date("2026-06-08T23:00:00Z"),
        new Date("2026-06-08T01:00:00Z"),
      ),
    ).toBe(0);
  });
  test("next day is 1", () => {
    expect(
      dayDiff(new Date("2026-06-08T12:00:00Z"), new Date("2026-06-09T00:00:00Z")),
    ).toBe(1);
  });
  test("past date is negative", () => {
    expect(
      dayDiff(new Date("2026-06-08T00:00:00Z"), new Date("2026-06-05T00:00:00Z")),
    ).toBe(-3);
  });
});

describe("relativeDay — agenda countdown label", () => {
  const now = new Date("2026-06-08T09:00:00Z");
  test("today", () => {
    expect(relativeDay(now, new Date("2026-06-08T20:00:00Z"))).toBe("Today");
  });
  test("tomorrow", () => {
    expect(relativeDay(now, new Date("2026-06-09T08:00:00Z"))).toBe("Tomorrow");
  });
  test("multi-day countdown", () => {
    expect(relativeDay(now, new Date("2026-06-13T08:00:00Z"))).toBe("in 5d");
  });
  test("a past event still reads Today (clamped, never negative)", () => {
    expect(relativeDay(now, new Date("2026-06-05T08:00:00Z"))).toBe("Today");
  });
});

describe("startOfUtcDay — inclusive lower bound for the query", () => {
  test("zeroes the time to UTC midnight of the same day", () => {
    const s = startOfUtcDay(new Date("2026-06-08T23:59:59Z"));
    expect(s.toISOString()).toBe("2026-06-08T00:00:00.000Z");
  });
});

describe("EVENTS cell surface", () => {
  const src = read("src/components/planner/PlannerUpcomingEventsCell.tsx");

  test("renders an EVENTS card on the shared Card primitive", () => {
    expect(src).toContain('title="EVENTS"');
    expect(src).toContain('from "@/components/ui/Card"');
  });

  test("reuses the calendar's events data — no new backend", () => {
    expect(src).toContain("listUpcomingEvents");
    expect(src).toContain('from "@/db/queries/events"');
  });

  test("colours each event by kind, matching the calendar legend", () => {
    expect(src).toContain("--color-red"); // tournament
    expect(src).toContain("--color-yellow"); // deadline
    expect(src).toContain("--color-purple-pastel"); // battle
    expect(src).toContain("--color-cyan"); // other
  });

  test("has a tasteful empty state pointing at the calendar", () => {
    expect(src).toMatch(/No upcoming events/i);
  });
});

describe("DASHBOARD rail wires EVENTS between calendar and activity", () => {
  const widgets = read("src/components/dashboard/DashboardWidgets.tsx");

  test("the rail renders the EVENTS cell", () => {
    expect(widgets).toContain("PlannerUpcomingEventsCell");
  });

  test("EVENTS sits between the calendar and the activity tracker (mockup order)", () => {
    // Match the rendered JSX tags (not the import lines) so the assertion
    // tracks the on-screen rail order: PLANNER → EVENTS → ACTIVITY.
    const cal = widgets.indexOf("<PlannerCalendarCell");
    const events = widgets.indexOf("<PlannerUpcomingEventsCell");
    const activity = widgets.indexOf("<PlannerActivityCell");
    expect(cal).toBeGreaterThan(-1);
    expect(cal).toBeLessThan(events);
    expect(events).toBeLessThan(activity);
  });

  test("the EVENTS cell has a Suspense skeleton fallback", () => {
    expect(widgets).toContain("EventsSkeleton");
  });
});
