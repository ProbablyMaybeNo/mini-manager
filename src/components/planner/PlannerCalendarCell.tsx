import { Card } from "@/components/ui/Card";
import { currentUserId } from "@/lib/auth-stub";
import { listEventsInMonth } from "@/db/queries/events";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { parseCalSearchParams } from "./plannerCalendarHelpers";

/**
 * P14.3 — Calendar cell.
 *
 * Async server component. Resolves the focused month (driven by the
 * `?calYear` / `?calMonth` query params the prev / next nav writes
 * client-side), fetches events for that month for the current user,
 * and hands the grid the data it needs. The grid is a client
 * component that owns the actual interactivity: navigation, day
 * expansion, edit/delete affordances, and the add-event form.
 *
 * Adding an event:
 *   "Your painting calendar — tournaments, deadlines, battles.
 *   Add an event to start."  ← copy still surfaced inside the grid
 *   when the focused month is empty (CalendarMonthGrid handles its
 *   own empty messaging via the AddEventForm below the grid).
 */

interface Props {
  /** Optional `?calYear` from the page's searchParams. */
  calYear?: string;
  /** Optional `?calMonth` from the page's searchParams.
   *
   *  UX-1104 — 1-indexed in the URL contract (Jan = 1, Dec = 12) to
   *  match the universal human convention. Painters who bookmark or
   *  share a `?calMonth=7` URL land on July, not August. The cell
   *  converts to the 0-based index the grid expects internally. */
  calMonth?: string;
}

export async function PlannerCalendarCell({ calYear, calMonth }: Props) {
  const userId = await currentUserId();
  const { year, monthIndex } = parseCalSearchParams(calYear, calMonth);
  const events = await listEventsInMonth(userId, year, monthIndex);

  return (
    // P14.8 — tighter inner padding on mobile so the 7-col day grid
    // can clear the ~40px tap-target floor at 375px viewport. The
    // !-overrides beat the global .card-body media-query padding.
    <Card
      title="CALENDAR"
      titleAs="h3"
      accentColor="amber"
      bodyClassName="!p-2 sm:!p-3.5"
    >
      <div className="space-y-3">
        <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
          Your painting calendar — tournaments, deadlines, battles.
          Add an event to start.
        </p>
        <CalendarMonthGrid
          events={events.map((ev) => ({
            id: ev.id,
            name: ev.name,
            eventDate: ev.eventDate,
            kind: ev.kind,
            notes: ev.notes,
          }))}
          year={year}
          monthIndex={monthIndex}
        />
      </div>
    </Card>
  );
}
