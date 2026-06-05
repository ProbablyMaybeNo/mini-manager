import { PlannerActivityCell } from "@/components/planner/PlannerActivityCell";
import { PlannerCalendarCell } from "@/components/planner/PlannerCalendarCell";
import { PlannerStreakCell } from "@/components/planner/PlannerStreakCell";

/**
 * FOCUS-DASH (2026-06-04) — the DASHBOARD widget row.
 *
 * Small square widget sections that MOVED from the planner to sit below
 * the project table on the DASHBOARD (/projects): the activity tracker,
 * the streak counter, and the calendar. The reference inspo board left
 * for the FOCUS screen; these three stay with the project workbench.
 *
 * Reuses the existing planner cells verbatim (PlannerActivityCell /
 * PlannerStreakCell / PlannerCalendarCell) — no widget is rebuilt. The
 * cells self-fetch per-user data; this composite only owns the grid +
 * threads the calendar's `?calYear` / `?calMonth` search-params for
 * prev / next month nav, exactly as the planner route used to.
 *
 * Layout: single stack on mobile, a 3-up row on md+ — Streak (smallest,
 * most reward-loaded) → Activity (freshest action) → Calendar.
 */
interface Props {
  calYear?: string;
  calMonth?: string;
}

export function DashboardWidgets({ calYear, calMonth }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <PlannerStreakCell />
      <PlannerActivityCell />
      <PlannerCalendarCell calYear={calYear} calMonth={calMonth} />
    </div>
  );
}
