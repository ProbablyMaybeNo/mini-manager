/**
 * P14.3 / UX-1104 — Pure helper for the calendar widget's URL
 * boundary.
 *
 * Lives outside PlannerCalendarCell.tsx so unit tests can import it
 * in the node env without next-auth (same pattern as
 * plannerStreakHelpers.ts + plannerHeatmapHelpers.ts).
 */

/**
 * Parse the `?calYear` + `?calMonth` URL search params into the year
 * + 0-based month index the grid component consumes.
 *
 * UX-1104 — `calMonth` is parsed as **1-indexed** (`1` = January,
 * `12` = December) so the URL contract matches human convention.
 * Painters who bookmark or share `?calMonth=7` land on July, not
 * August (the prior 0-based contract sent them one month forward).
 *
 * Out-of-range values (0, 13, 'abc', empty, undefined) fall back to
 * today's UTC month — same defensive behaviour the prior 0-based
 * parser had.
 *
 *   parseCalSearchParams("2026", "7")    -> { year: 2026, monthIndex: 6 }   // July
 *   parseCalSearchParams("2026", "12")   -> { year: 2026, monthIndex: 11 }  // December
 *   parseCalSearchParams("2026", "0")    -> falls back to today
 *   parseCalSearchParams("2026", "13")   -> falls back to today
 *   parseCalSearchParams(undefined, "7") -> { year: today.year, monthIndex: 6 }
 */
export function parseCalSearchParams(
  rawYear: string | undefined,
  rawMonth: string | undefined,
  now: Date = new Date(),
): { year: number; monthIndex: number } {
  const fallbackYear = now.getUTCFullYear();
  const fallbackMonth = now.getUTCMonth();

  const yearNum = rawYear ? Number(rawYear) : NaN;
  const monthNum = rawMonth ? Number(rawMonth) : NaN;

  const year =
    Number.isFinite(yearNum) && yearNum > 1970 && yearNum < 3000
      ? Math.trunc(yearNum)
      : fallbackYear;
  // 1-indexed in the URL → 0-indexed for the grid component. Reject
  // 0, negative numbers, and >12 by falling back to today's month.
  const monthIndex =
    Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12
      ? Math.trunc(monthNum) - 1
      : fallbackMonth;
  return { year, monthIndex };
}
