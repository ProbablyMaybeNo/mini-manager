import { describe, expect, test } from "vitest";
import { calendarDayIso, isCalendarDay, todayIso } from "@/lib/calendarDay";

/**
 * R4-6 — the planner grid marks today. The grid indexes months from 0 and the
 * rest of the dashboard writes them 1-based, so the only way this quietly goes
 * wrong is by marking the right day number in the wrong month. That is the
 * thing worth pinning.
 */
describe("calendarDayIso", () => {
  test("writes the 0-indexed month 1-based, zero-padded", () => {
    expect(calendarDayIso(2026, 0, 1)).toBe("2026-01-01");
    expect(calendarDayIso(2026, 7, 4)).toBe("2026-08-04");
    expect(calendarDayIso(2026, 11, 31)).toBe("2026-12-31");
  });
});

describe("todayIso", () => {
  test("is UTC, and the same shape the rest of the dashboard compares against", () => {
    expect(todayIso(new Date("2026-08-04T00:30:00Z"))).toBe("2026-08-04");
    // 23:30 UTC is already "tomorrow" in a +01:00 local zone; the whole
    // dashboard (RightRail, DashboardView, rosterStatus) reads UTC, so the
    // grid must too or the marked cell and the UPCOMING list would disagree.
    expect(todayIso(new Date("2026-08-04T23:30:00Z"))).toBe("2026-08-04");
  });
});

describe("isCalendarDay", () => {
  const today = "2026-08-04";

  test("matches exactly one cell in the month it belongs to", () => {
    expect(isCalendarDay(2026, 7, 4, today)).toBe(true);
    expect(isCalendarDay(2026, 7, 3, today)).toBe(false);
    expect(isCalendarDay(2026, 7, 5, today)).toBe(false);
  });

  test("does not match the same day number in another month or year", () => {
    // The off-by-one this exists to catch: month 8 is September, not August.
    expect(isCalendarDay(2026, 8, 4, today)).toBe(false);
    expect(isCalendarDay(2026, 6, 4, today)).toBe(false);
    expect(isCalendarDay(2025, 7, 4, today)).toBe(false);
  });

  test("marks nothing for a leading blank cell or a grid with no today", () => {
    expect(isCalendarDay(2026, 7, null, today)).toBe(false);
    expect(isCalendarDay(2026, 7, 4, undefined)).toBe(false);
    expect(isCalendarDay(2026, 7, 4, null)).toBe(false);
    expect(isCalendarDay(2026, 7, 4, "")).toBe(false);
  });
});
