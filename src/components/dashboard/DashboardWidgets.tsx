import { Suspense } from "react";
import { PlannerActivityCell } from "@/components/planner/PlannerActivityCell";
import { PlannerCalendarCell } from "@/components/planner/PlannerCalendarCell";
import {
  ActivitySkeleton,
  CalendarSkeleton,
} from "@/components/dashboard/DashboardSkeletons";

/**
 * FOCUS-DASH (2026-06-04) — the DASHBOARD widget row.
 *
 * Small widget sections that MOVED from the planner to sit below the
 * project table on the DASHBOARD (/projects): the activity tracker and
 * the calendar. The reference inspo board left for the FOCUS screen;
 * these stay with the project workbench.
 *
 * Reuses the existing planner cells verbatim (PlannerActivityCell /
 * PlannerCalendarCell) — no widget is rebuilt. The cells self-fetch
 * per-user data; this composite only owns the grid + threads the
 * calendar's `?calYear` / `?calMonth` search-params for prev / next
 * month nav, exactly as the planner route used to.
 *
 * DASH-PYRAMID (2026-06-05) — inverted-pyramid re-sequence. The Streak
 * NUMBER was promoted into the top KPI strip (DashboardKpiStrip), so the
 * standalone Streak cell is removed from this trio to avoid showing the
 * same headline number twice. The widget row is now the pyramid's
 * "detail" layer: a freshest-action Activity log beside the Calendar.
 *
 * Layout (holds the prior DASH-PROPORTION row rhythm — no floating gap):
 *   - On `md+`: a 3-column grid. The Calendar is the wide, tall column —
 *     it spans 2 of the 3 columns (`md:col-span-2`). Activity is the
 *     narrow left column, `h-full` so it matches the Calendar's height
 *     exactly; its internal list scrolls (`min-h-0 overflow-y-auto` on
 *     the cell) so a long stream can't out-grow the Calendar beside it.
 *   - On `<md`: single-column stack — Activity (freshest action), then
 *     Calendar.
 *
 * The cells stay verbatim; the wrapper `h-full` + the Card primitive's
 * `flex flex-col` body let each widget fill its grid cell without
 * rebuilding the widgets themselves.
 *
 * DASH-SKELETON (2026-06-05) — each async cell is wrapped in <Suspense>
 * with an in-theme skeleton that mirrors the card layout (doc §10), so
 * first paint shows a phosphor-styled placeholder instead of a flash of
 * empty cards. Skeletons keep the same Card + height, so nothing shifts
 * when the data lands.
 */
interface Props {
  calYear?: string;
  calMonth?: string;
}

export function DashboardWidgets({ calYear, calMonth }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Activity — mobile order 1; desktop narrow left column. */}
      <div className="h-full md:col-start-1">
        <Suspense fallback={<ActivitySkeleton />}>
          <PlannerActivityCell />
        </Suspense>
      </div>
      {/* Calendar — the wide column. Spans both other columns so it sets
          the rectangle's width; Activity matches its height on the left. */}
      <div className="h-full md:col-start-2 md:col-span-2">
        <Suspense fallback={<CalendarSkeleton />}>
          <PlannerCalendarCell calYear={calYear} calMonth={calMonth} />
        </Suspense>
      </div>
    </div>
  );
}
