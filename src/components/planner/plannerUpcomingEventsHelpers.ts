/**
 * DASHBOARD-POLISH (fix #4) — pure date helpers for the right-rail EVENTS
 * section. Split out of PlannerUpcomingEventsCell (a DB-bound async server
 * component) so the countdown logic is unit-testable without pulling the
 * auth / db import chain — the same split the other planner cells use
 * (plannerActivityHelpers / plannerCalendarHelpers).
 */

/** Whole-day difference between two dates, computed on their UTC calendar
 *  days so a "today" event reads 0 and a "tomorrow" event reads 1 regardless
 *  of the wall-clock time of day. */
export function dayDiff(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

/** Short relative-day countdown ("Today", "Tomorrow", "in 5d"). Past dates
 *  clamp to "Today" so the agenda never shows a negative countdown. */
export function relativeDay(now: Date, when: Date): string {
  const d = dayDiff(now, when);
  if (d <= 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `in ${d}d`;
}

/** Start of the given date's UTC calendar day — the inclusive lower bound
 *  for the upcoming-events query, so an event dated earlier *today* still
 *  counts as upcoming. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Short absolute date for the agenda line, e.g. "8 Jun". UTC so it matches
 *  the events' midnight-UTC storage. */
export const shortEventDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
