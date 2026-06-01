/**
 * UX-1104 — `?calMonth` URL search-param contract.
 *
 * The audit caught that `calMonth` was 0-indexed (Jan = 0, Dec = 11),
 * matching JavaScript's `Date.getMonth()` internal convention but
 * contradicting the universal human convention that "month 7" means
 * July. The boundary now parses 1-indexed and writes 1-indexed.
 *
 * This file pins:
 *   - parseCalSearchParams runtime: 1-indexed in → 0-indexed out
 *   - out-of-range fallback unchanged
 *   - the grid's navigate() writes `nextMonth + 1` to the URL
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseCalSearchParams } from "@/components/planner/plannerCalendarHelpers";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

const NOW = new Date("2026-06-15T12:00:00.000Z");

describe("parseCalSearchParams (UX-1104)", () => {
  test("calMonth=1 → January (monthIndex 0)", () => {
    expect(parseCalSearchParams("2026", "1", NOW)).toEqual({
      year: 2026,
      monthIndex: 0,
    });
  });

  test("calMonth=6 → June (monthIndex 5) — the screenshot case", () => {
    // The audit screenshot ss_2551ntyvc had calMonth=6 displaying
    // July. After the fix, calMonth=6 displays June.
    expect(parseCalSearchParams("2026", "6", NOW)).toEqual({
      year: 2026,
      monthIndex: 5,
    });
  });

  test("calMonth=7 → July (monthIndex 6) — the screenshot case", () => {
    // The audit screenshot ss_4890loyzg had calMonth=7 displaying
    // August. After the fix, calMonth=7 displays July.
    expect(parseCalSearchParams("2026", "7", NOW)).toEqual({
      year: 2026,
      monthIndex: 6,
    });
  });

  test("calMonth=12 → December (monthIndex 11)", () => {
    expect(parseCalSearchParams("2026", "12", NOW)).toEqual({
      year: 2026,
      monthIndex: 11,
    });
  });

  test("calMonth=0 falls back to today's month (no longer a valid Jan key)", () => {
    // The old 0-based contract accepted 0 as January. The new 1-based
    // contract treats 0 as out-of-range and falls back to today.
    expect(parseCalSearchParams("2026", "0", NOW)).toEqual({
      year: 2026,
      monthIndex: 5, // June 2026 — NOW
    });
  });

  test("calMonth=13 falls back to today's month (out of range)", () => {
    expect(parseCalSearchParams("2026", "13", NOW)).toEqual({
      year: 2026,
      monthIndex: 5,
    });
  });

  test("calMonth='abc' falls back to today's month", () => {
    expect(parseCalSearchParams("2026", "abc", NOW)).toEqual({
      year: 2026,
      monthIndex: 5,
    });
  });

  test("calMonth=undefined falls back to today's month", () => {
    expect(parseCalSearchParams("2026", undefined, NOW)).toEqual({
      year: 2026,
      monthIndex: 5,
    });
  });

  test("calYear out of range falls back to today's year", () => {
    expect(parseCalSearchParams("1800", "7", NOW)).toEqual({
      year: 2026,
      monthIndex: 6,
    });
  });

  test("both params undefined returns today's year + month", () => {
    expect(parseCalSearchParams(undefined, undefined, NOW)).toEqual({
      year: 2026,
      monthIndex: 5,
    });
  });

  test("fractional months get truncated, then converted", () => {
    // Defensive: `7.9` → trunc → 7 → -1 = 6 (July).
    expect(parseCalSearchParams("2026", "7.9", NOW)).toEqual({
      year: 2026,
      monthIndex: 6,
    });
  });
});

describe("CalendarMonthGrid URL writer (UX-1104)", () => {
  const src = read("src/components/planner/CalendarMonthGrid.tsx");

  test("navigate() writes calMonth as 1-indexed (nextMonth + 1)", () => {
    // The grid's internal `nextMonth` stays 0-based; the URL writer
    // converts on the way out so the bookmark / share-URL contract
    // is human-friendly.
    expect(src).toMatch(/params\.set\("calMonth",\s*String\(nextMonth\s*\+\s*1\)\)/);
  });

  test("navigate() no longer writes the raw 0-based nextMonth", () => {
    expect(src).not.toMatch(/params\.set\("calMonth",\s*String\(nextMonth\)\)/);
  });
});

describe("PlannerCalendarCell wiring (UX-1104)", () => {
  const src = read("src/components/planner/PlannerCalendarCell.tsx");

  test("uses the shared parseCalSearchParams helper, not an inline parser", () => {
    expect(src).toContain("parseCalSearchParams");
    // The prior inline `parseYearMonth` helper is gone.
    expect(src).not.toMatch(/function parseYearMonth\(/);
  });
});
