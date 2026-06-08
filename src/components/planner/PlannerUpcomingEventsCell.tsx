import { clsx } from "clsx";
import { Card } from "@/components/ui/Card";
import { currentUserId } from "@/lib/auth-stub";
import { listUpcomingEvents } from "@/db/queries/events";
import type { EventKind } from "@/db/schema";
import {
  relativeDay,
  shortEventDate,
  startOfUtcDay,
} from "./plannerUpcomingEventsHelpers";

/**
 * DASHBOARD-POLISH (fix #4) — the right-rail EVENTS section.
 *
 * Ross's mockup shows the right rail as PLANNER calendar → EVENTS list →
 * ACTIVITY. The calendar + activity already existed; this is the missing
 * EVENTS section. It is NOT a new feature/backend — it reuses the SAME
 * `events` table the calendar reads, just queried as a flat "soonest first"
 * upcoming list (`listUpcomingEvents`). So the rail's EVENTS section is the
 * calendar's data surfaced as a glanceable agenda.
 *
 * Async server component, self-fetching per-user like its sibling cells. A
 * coloured kind-dot (matching the calendar's tournament=red / deadline=
 * yellow / battle=purple / other=cyan legend) precedes each event name, with
 * a relative-day countdown on the right. Empty state nudges the painter to
 * add an event in the calendar above — no separate add UI here (the calendar
 * owns event creation).
 */

const KIND_DOT_CLASS: Record<EventKind, string> = {
  tournament: "bg-[var(--color-red)]",
  deadline: "bg-[var(--color-yellow)]",
  battle: "bg-[var(--color-purple-pastel)]",
  other: "bg-[var(--color-cyan)]",
};

const KIND_LABEL: Record<EventKind, string> = {
  tournament: "Tournament",
  deadline: "Deadline",
  battle: "Battle",
  other: "Other",
};

export interface PlannerUpcomingEventsCellProps {
  /** Test seam — override "now" so the relative countdown is deterministic.
   *  Defaults to the request time. */
  now?: Date;
  /** How many upcoming events to list. Rail real-estate is tight, so a
   *  short agenda (default 5). */
  limit?: number;
}

export async function PlannerUpcomingEventsCell({
  now,
  limit = 5,
}: PlannerUpcomingEventsCellProps = {}) {
  const referenceNow = now ?? new Date();
  // Anchor the lower bound at the start of today (UTC) so an event dated
  // earlier today still counts as upcoming.
  const events = await listUpcomingEvents(
    await currentUserId(),
    startOfUtcDay(referenceNow),
    limit,
  );

  return (
    <Card
      title="EVENTS"
      titleAs="h3"
      accentColor="cyan"
      ticks
      techLabel="CAL ▸ NEXT"
      className="h-full"
      bodyClassName="flex-1 flex flex-col"
    >
      {events.length === 0 ? (
        <p className="text-sm font-sans text-[var(--color-fg-muted)] leading-relaxed">
          No upcoming events. Add a tournament, deadline or battle in the
          calendar above and it&apos;ll show up here.
        </p>
      ) : (
        <ol className="space-y-2 list-none">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex items-baseline gap-2 text-sm font-sans leading-snug"
            >
              <span
                aria-hidden
                className={clsx(
                  "mt-1.5 block w-2 h-2 rounded-full shrink-0",
                  KIND_DOT_CLASS[ev.kind],
                )}
              />
              <span className="flex-1 min-w-0 text-[var(--color-fg)] break-words">
                <span className="sr-only">{KIND_LABEL[ev.kind]}: </span>
                {ev.name}
                <span className="ml-1.5 text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                  {shortEventDate.format(ev.eventDate)}
                </span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-[var(--color-fg-muted)] whitespace-nowrap">
                {relativeDay(referenceNow, ev.eventDate)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
