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
      {/* Activity feed kept compact + scrollable (UF5H): a fixed max height
          with internal overflow so a long history never stretches the rail. */}
      <Panel label="ACTIVITY TRACKER" className="p-3">
        <div className="max-h-56 overflow-y-auto pr-1">
          <ActivityFeed entries={activity} />
        </div>
      </Panel>
    </div>
  );
}
