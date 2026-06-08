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
 * DASHBOARD-REDESIGN (Part B item 3) — the widgets now form the dashboard's
 * RIGHT RAIL (Ross's mockup): a VERTICAL stack, not a wide 3-col row. From
 * the top: the compact + scrollable PLANNER calendar, then the ACTIVITY
 * tracker (PAINT / OWNED / BUILT / PRIMED recent actions). The page lays the
 * PROJECTS table beside this rail on `lg+`; on smaller screens the rail
 * stacks below the table. The cells stay verbatim — only the composition
 * (row → vertical rail) changed.
 *
 * DASH-SKELETON — each async cell is wrapped in <Suspense> with an in-theme
 * skeleton that mirrors the card layout (doc §10), so first paint shows a
 * phosphor-styled placeholder instead of a flash of empty cards.
 */
interface Props {
  calYear?: string;
  calMonth?: string;
}

export function DashboardWidgets({ calYear, calMonth }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* Calendar — compact + scrollable, top of the rail (the mockup's
          small PLANNER calendar). */}
      <Suspense fallback={<CalendarSkeleton />}>
        <PlannerCalendarCell calYear={calYear} calMonth={calMonth} />
      </Suspense>
      {/* Activity tracker — recent PAINT / OWNED / BUILT / PRIMED actions. */}
      <Suspense fallback={<ActivitySkeleton />}>
        <PlannerActivityCell />
      </Suspense>
    </div>
  );
}
