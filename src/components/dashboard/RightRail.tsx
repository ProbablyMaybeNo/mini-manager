import { ActivityFeed, Panel } from "@/components/kit";
import type { ActivityEntry, CalendarEvent } from "@/lib/types";
import { PlannerCalendar } from "./PlannerCalendar";

/** Dashboard right rail: PLANNER calendar over the ACTIVITY TRACKER. */
export function RightRail({
  events,
  activity,
}: {
  events: CalendarEvent[];
  activity: ActivityEntry[];
}) {
  return (
    <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[200px]">
      {/* Calendar made much smaller (r-N-8): the PLANNER panel is capped to a
          compact width so the month grid reads as a glanceable mini-calendar,
          not a full-size one. */}
      <Panel label="PLANNER" className="p-3">
        <PlannerCalendar events={events} />
      </Panel>
      {/* Activity feed kept compact + scrollable (UF5HOwXMpJxP): capped height
          with internal overflow so a long history scrolls in place and never
          stretches the rail or dominates the page. The cap also shrinks on
          short viewports (min of 14rem / 30vh) so it stays glanceable. */}
      <Panel label="ACTIVITY TRACKER" className="p-3">
        {/* pt-1 nudges the first row down a smidge so its icon/text isn't
            clipped against the scroll container's top edge (oRc-Pp1u9Gsk). */}
        <div className="max-h-[min(14rem,30vh)] overflow-y-auto pr-1 pt-1">
          <ActivityFeed entries={activity} />
        </div>
      </Panel>
    </div>
  );
}
