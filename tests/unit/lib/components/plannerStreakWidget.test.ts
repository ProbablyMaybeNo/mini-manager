/**
 * P14.5 - PlannerStreakCell unit tests.
 *
 * Pure-helper coverage. The cell itself is an async server component;
 * the data layer (getActivityByDay) is covered by
 * tests/integration/actions/activityLogQueries.test.ts.
 */
import { describe, expect, test } from "vitest";
import type { ActivityDay } from "@/db/queries/activityLog";
import {
  computeStreak,
  dayHasStreakActivity,
  microcopyFor,
} from "@/components/planner/plannerStreakHelpers";

function day(
  date: string,
  kinds: ReadonlyArray<ActivityDay["kinds"][number]>,
): ActivityDay {
  return { date, count: kinds.length, kinds };
}

const TODAY = new Date("2026-06-01T12:00:00.000Z");
const todayKey = "2026-06-01";

describe("dayHasStreakActivity (P14.5)", () => {
  test("stage_bump qualifies", () => {
    expect(dayHasStreakActivity(day(todayKey, ["stage_bump"]))).toBe(true);
  });

  test("recipe_created qualifies", () => {
    expect(dayHasStreakActivity(day(todayKey, ["recipe_created"]))).toBe(true);
  });

  test("paint_added alone does NOT qualify", () => {
    expect(dayHasStreakActivity(day(todayKey, ["paint_added"]))).toBe(false);
  });

  test("project_created alone does NOT qualify", () => {
    expect(dayHasStreakActivity(day(todayKey, ["project_created"]))).toBe(
      false,
    );
  });

  test("slot_added alone does NOT qualify", () => {
    expect(dayHasStreakActivity(day(todayKey, ["slot_added"]))).toBe(false);
  });

  test("a mixed day qualifies if any qualifying kind is present", () => {
    expect(
      dayHasStreakActivity(day(todayKey, ["paint_added", "stage_bump"])),
    ).toBe(true);
  });
});

describe("computeStreak (P14.5)", () => {
  test("empty input -> streak 0, daysSinceLast null", () => {
    const res = computeStreak([], TODAY);
    expect(res.streak).toBe(0);
    expect(res.daysSinceLast).toBeNull();
  });

  test("only non-qualifying days -> streak 0, daysSinceLast null", () => {
    const res = computeStreak(
      [
        day("2026-05-31", ["paint_added"]),
        day("2026-05-30", ["project_created"]),
      ],
      TODAY,
    );
    expect(res.streak).toBe(0);
    expect(res.daysSinceLast).toBeNull();
  });

  test("painted today only -> streak 1", () => {
    const res = computeStreak([day(todayKey, ["stage_bump"])], TODAY);
    expect(res.streak).toBe(1);
    expect(res.daysSinceLast).toBe(0);
  });

  test("painted yesterday but not today -> streak 1 (anchor shifts to yesterday)", () => {
    const res = computeStreak(
      [day("2026-05-31", ["stage_bump"])],
      TODAY,
    );
    expect(res.streak).toBe(1);
    expect(res.daysSinceLast).toBe(1);
  });

  test("3-day chain including today -> streak 3", () => {
    const res = computeStreak(
      [
        day(todayKey, ["stage_bump"]),
        day("2026-05-31", ["stage_bump"]),
        day("2026-05-30", ["recipe_created"]),
      ],
      TODAY,
    );
    expect(res.streak).toBe(3);
    expect(res.daysSinceLast).toBe(0);
  });

  test("a 1-day gap breaks the streak", () => {
    const res = computeStreak(
      [
        day(todayKey, ["stage_bump"]),
        // Gap on 2026-05-31
        day("2026-05-30", ["stage_bump"]),
        day("2026-05-29", ["stage_bump"]),
      ],
      TODAY,
    );
    expect(res.streak).toBe(1);
  });

  test("a non-qualifying day breaks the streak (paint_added gap)", () => {
    const res = computeStreak(
      [
        day(todayKey, ["stage_bump"]),
        day("2026-05-31", ["paint_added"]),
        day("2026-05-30", ["stage_bump"]),
      ],
      TODAY,
    );
    expect(res.streak).toBe(1);
  });

  test("a 7-day chain including today reads as 7", () => {
    const days: ActivityDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(TODAY.getTime() - i * 24 * 60 * 60 * 1000);
      const key =
        d.getUTCFullYear() +
        "-" +
        String(d.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getUTCDate()).padStart(2, "0");
      days.push(day(key, ["stage_bump"]));
    }
    const res = computeStreak(days, TODAY);
    expect(res.streak).toBe(7);
  });

  test("daysSinceLast counts the gap to the most recent qualifying day", () => {
    const res = computeStreak(
      [day("2026-05-28", ["stage_bump"])], // 4 days before today
      TODAY,
    );
    expect(res.streak).toBe(0);
    expect(res.daysSinceLast).toBe(4);
  });
});

describe("microcopyFor (P14.5)", () => {
  test("streak >= 7 uses the celebratory line", () => {
    expect(
      microcopyFor({ streak: 7, daysSinceLast: 0 }),
    ).toBe("On a 7-day painting streak — keep it up.");
  });

  test("streak 14 still uses the celebratory line", () => {
    expect(microcopyFor({ streak: 14, daysSinceLast: 0 })).toBe(
      "On a 14-day painting streak — keep it up.",
    );
  });

  test("streak in 2-6 uses the chain line with plural 'days'", () => {
    // UX-1101 — count > 1 keeps "days" plural.
    expect(microcopyFor({ streak: 3, daysSinceLast: 0 })).toBe(
      "3 days — don't break the chain.",
    );
  });

  test("streak 1 uses the singular 'day' (UX-1101)", () => {
    // UX-1101 — count === 1 must pluralise correctly.
    expect(microcopyFor({ streak: 1, daysSinceLast: 0 })).toBe(
      "1 day — don't break the chain.",
    );
  });

  test("streak 0 + recent activity (multi-day) uses the come-back line", () => {
    expect(microcopyFor({ streak: 0, daysSinceLast: 2 })).toBe(
      "Last paint: 2 days ago — break it open.",
    );
  });

  test("streak 0 + 1-day-ago activity uses singular 'day' (UX-1101)", () => {
    // UX-1101 — singular form for daysSinceLast === 1.
    expect(microcopyFor({ streak: 0, daysSinceLast: 1 })).toBe(
      "Last paint: 1 day ago — break it open.",
    );
  });

  test("streak 0 + activity > 3 days ago uses the empty-state line", () => {
    expect(microcopyFor({ streak: 0, daysSinceLast: 10 })).toBe(
      "Bump a stage to start your streak.",
    );
  });

  test("no activity ever uses the empty-state line", () => {
    expect(microcopyFor({ streak: 0, daysSinceLast: null })).toBe(
      "Bump a stage to start your streak.",
    );
  });
});
