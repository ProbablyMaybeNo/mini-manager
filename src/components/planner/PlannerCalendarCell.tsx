import { Card } from "@/components/ui/Card";
import { currentUserId } from "@/lib/auth-stub";
import { listEventsInMonth } from "@/db/queries/events";
import { CalendarMonthGrid } from "./CalendarMonthGrid";

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
  /** Optional `?calMonth` (0-based) from the page's searchParams. */
  calMonth?: string;
}

function parseYearMonth(
  rawYear: string | undefined,
  rawMonth: string | undefined,
): { year: number; monthIndex: number } {
  const now = new Date();
  const fallbackYear = now.getUTCFullYear();
  const fallbackMonth = now.getUTCMonth();

  const yearNum = rawYear ? Number(rawYear) : NaN;
  const monthNum = rawMonth ? Number(rawMonth) : NaN;

  const year = Number.isFinite(yearNum) && yearNum > 1970 && yearNum < 3000
    ? Math.trunc(yearNum)
    : fallbackYear;
  const monthIndex =
    Number.isFinite(monthNum) && monthNum >= 0 && monthNum <= 11
      ? Math.trunc(monthNum)
      : fallbackMonth;
  return { year, monthIndex };
}

export async function PlannerCalendarCell({ calYear, calMonth }: Props) {
  const userId = await currentUserId();
  const { year, monthIndex } = parseYearMonth(calYear, calMonth);
  const events = await listEventsInMonth(userId, year, monthIndex);

  return (
    <Card title="CALENDAR" titleAs="h3" accentColor="amber">
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
