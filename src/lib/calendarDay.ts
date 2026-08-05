/**
 * Day-key helpers for the month grids (R4-6).
 *
 * Everything dashboard-side agrees that "today" is `YYYY-MM-DD` in UTC —
 * `RightRail`, `DashboardView` and `rosterStatus` all derive it as
 * `new Date().toISOString().slice(0, 10)` — and the grids build their cells
 * from `Date.UTC`, so the two are directly comparable. The only thing that can
 * quietly go wrong is the 0-indexed month, which is why it lives here with
 * tests rather than inline as a template string.
 */

/** `YYYY-MM-DD` for a cell in a 0-INDEXED-month calendar grid. */
export function calendarDayIso(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Today as `YYYY-MM-DD`, UTC — the form the rest of the dashboard uses. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Is this grid cell (0-indexed month) the given day? `today` is optional so a
 * grid that is not showing "now" — the kit gallery, a date picker — simply
 * marks nothing.
 */
export function isCalendarDay(
  year: number,
  month: number,
  day: number | null,
  today: string | null | undefined,
): boolean {
  if (day == null || !today) return false;
  return calendarDayIso(year, month, day) === today;
}
