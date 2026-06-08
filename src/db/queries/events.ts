import "server-only";

import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { events, type Event, type EventKind } from "@/db/schema";

/**
 * P14.3 — Calendar widget data layer.
 *
 * The dashboard PLANNER calendar reads a single month at a time. The
 * grid is rendered server-side off the focused month's rows; prev /
 * next nav re-queries the next slice. Rows return ordered by
 * `eventDate` ascending so a day with multiple events renders them
 * in chronological order in the expanded-day list.
 */
export interface MonthRange {
  /** Inclusive lower bound — first ms of the month (UTC). */
  start: Date;
  /** Inclusive upper bound — last ms of the month (UTC). */
  end: Date;
}

/**
 * Build the inclusive UTC range covering an entire calendar month for
 * the given `year` / `monthIndex` (0-based, matching JS Date).
 *
 * Pure helper so the calendar component can also compute its own
 * boundaries client-side for prev / next nav.
 */
export function monthRange(year: number, monthIndex: number): MonthRange {
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  // The first ms of the *next* month, minus one ms.
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0) - 1);
  return { start, end };
}

/** Lean shape the calendar grid renders — only the bits the widget
 *  needs to draw coloured dots + day-list entries. */
export interface CalendarEvent {
  id: string;
  name: string;
  eventDate: Date;
  kind: EventKind;
  notes: string | null;
}

/**
 * Fetch every event for a user inside a calendar month. Ordered by
 * `eventDate asc` so the day-expansion list reads chronologically.
 *
 * Owner-scoped — only the calling user's rows come back. The
 * `event_user_date_idx` covers this lookup.
 */
export async function listEventsInMonth(
  userId: string,
  year: number,
  monthIndex: number,
): Promise<ReadonlyArray<CalendarEvent>> {
  const { start, end } = monthRange(year, monthIndex);
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      eventDate: events.eventDate,
      kind: events.kind,
      notes: events.notes,
    })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        gte(events.eventDate, start),
        lte(events.eventDate, end),
      ),
    )
    .orderBy(asc(events.eventDate));
  return rows;
}

/**
 * DASHBOARD-POLISH (fix #4) — the right-rail EVENTS list.
 *
 * Fetch the next `limit` upcoming events for a user, from `from` (inclusive)
 * forward, ordered soonest-first. Owner-scoped; reuses the same `events`
 * table + `event_user_date_idx` the calendar reads, so the rail's EVENTS
 * section is just the calendar's data viewed as a flat upcoming list (no new
 * backend). Returns the lean `CalendarEvent` shape the calendar already uses.
 */
export async function listUpcomingEvents(
  userId: string,
  from: Date,
  limit = 5,
): Promise<ReadonlyArray<CalendarEvent>> {
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      eventDate: events.eventDate,
      kind: events.kind,
      notes: events.notes,
    })
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.eventDate, from)))
    .orderBy(asc(events.eventDate))
    .limit(limit);
  return rows;
}

/** Fetch a single event by id, owner-scoped. Returns null when the
 *  row doesn't belong to the caller — same defensive shape every
 *  other ownership-checked query uses. */
export async function getEventForOwner(
  userId: string,
  eventId: string,
): Promise<Event | null> {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}
