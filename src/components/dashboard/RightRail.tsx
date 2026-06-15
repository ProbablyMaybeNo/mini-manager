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
    <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[230px]">
      <Panel label="PLANNER" className="p-3">
        <PlannerCalendar events={events} />
      </Panel>
      <Panel label="ACTIVITY TRACKER" className="flex-1 p-3">
        <ActivityFeed entries={activity} />
      </Panel>
    </div>
  );
}
