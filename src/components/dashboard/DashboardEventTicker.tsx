import { clsx } from "clsx";
import { currentUserId } from "@/lib/auth-stub";
import { listUpcomingEvents } from "@/db/queries/events";
import {
  shortEventDate,
  startOfUtcDay,
} from "@/components/planner/plannerUpcomingEventsHelpers";

export interface DashboardEventTickerProps {
  /** Test seam — override "now" for deterministic countdowns. */
  now?: Date;
  limit?: number;
}

/**
 * FIGMA-REBUILD §3 — full-width footer ticker: `UPCOMING EVENTS:` +
 * event name (red) + details (white) + date (green, right-aligned).
 * Reuses the same `listUpcomingEvents` query as the planner rail.
 */
export async function DashboardEventTicker({
  now,
  limit = 8,
}: DashboardEventTickerProps = {}) {
  const referenceNow = now ?? new Date();
  const events = await listUpcomingEvents(
    await currentUserId(),
    startOfUtcDay(referenceNow),
    limit,
  );

  if (events.length === 0) return null;

  return (
    <div
      className={clsx(
        "panel panel-ticks relative",
        "border border-[color-mix(in_srgb,var(--color-cyan)_35%,var(--color-border))]",
      )}
      aria-label="Upcoming events"
    >
      <span className="panel-label" aria-hidden>
        CAL ▸ TICKER
      </span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 font-mono text-xs">
        <span className="shrink-0 uppercase tracking-[0.14em] text-[var(--color-cyan)]">
          Upcoming events:
        </span>
        <ul className="flex min-w-0 flex-1 list-none flex-wrap items-center gap-x-6 gap-y-1">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex min-w-0 max-w-full items-baseline gap-2"
            >
              <span className="truncate font-semibold uppercase tracking-wide text-[var(--color-red)]">
                {ev.name}
              </span>
              {ev.notes ? (
                <span className="hidden truncate text-[var(--color-fg)] sm:inline">
                  {ev.notes}
                </span>
              ) : null}
              <span className="shrink-0 tabular-nums text-[var(--color-green)]">
                {shortEventDate.format(ev.eventDate)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
