import { ActivityFeed, Panel } from "@/components/kit";
import { accentDot, eventKindAccent } from "@/lib/palette";
import { cn } from "@/lib/cn";
import type { ActivityEntry, CalendarEvent } from "@/lib/types";
import { PlannerCalendar } from "./PlannerCalendar";

/** Short "Jun 12" style date for the UPCOMING list, matching the 4:4 rail. */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Dashboard right rail (4:4): mini month calendar + UPCOMING list + RECENT
 *  ACTIVITY. The calendar carries its own ‹ › month nav and + Date button. */
export function RightRail({
  events,
  activity,
}: {
  events: CalendarEvent[];
  activity: ActivityEntry[];
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter((e) => e.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  return (
    <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[200px]">
      {/* Calendar made much smaller (r-N-8): the PLANNER panel is capped to a
          compact width so the month grid reads as a glanceable mini-calendar,
          not a full-size one. */}
      <Panel label="PLANNER" className="p-3">
        <PlannerCalendar events={events} />
      </Panel>

      {/* UPCOMING list (4:4): named events with their short date, today-forward.
          A coloured dot keys each event to its kind, matching the calendar dots. */}
      <Panel label="UPCOMING" className="p-3">
        {upcoming.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <span
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", accentDot[eventKindAccent[e.kind]])}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-mono text-body text-fg" title={e.name}>
                  {e.name}
                </span>
                <span className="shrink-0 font-mono text-num2 tabular-nums text-fg-dim">
                  {shortDate(e.date)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-mono text-body text-fg-dim">Nothing scheduled</p>
        )}
      </Panel>

      {/* Activity feed kept compact + scrollable (UF5HOwXMpJxP): capped height
          with internal overflow so a long history scrolls in place and never
          stretches the rail or dominates the page. The cap also shrinks on
          short viewports (min of 14rem / 30vh) so it stays glanceable. */}
      <Panel label="RECENT ACTIVITY" className="p-3">
        {/* pt-1 nudges the first row down a smidge so its icon/text isn't
            clipped against the scroll container's top edge (oRc-Pp1u9Gsk). */}
        <div className="max-h-[min(14rem,30vh)] overflow-y-auto pr-1 pt-1">
          <ActivityFeed entries={activity} />
        </div>
      </Panel>
    </div>
  );
}
