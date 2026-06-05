import { PlannerActivityCell } from "@/components/planner/PlannerActivityCell";
import { PlannerCalendarCell } from "@/components/planner/PlannerCalendarCell";
import { PlannerStreakCell } from "@/components/planner/PlannerStreakCell";

/**
 * FOCUS-DASH (2026-06-04) — the DASHBOARD widget row.
 *
 * Small widget sections that MOVED from the planner to sit below the
 * project table on the DASHBOARD (/projects): the activity tracker, the
 * streak counter, and the calendar. The reference inspo board left for
 * the FOCUS screen; these three stay with the project workbench.
 *
 * Reuses the existing planner cells verbatim (PlannerActivityCell /
 * PlannerStreakCell / PlannerCalendarCell) — no widget is rebuilt. The
 * cells self-fetch per-user data; this composite only owns the grid +
 * threads the calendar's `?calYear` / `?calMonth` search-params for
 * prev / next month nav, exactly as the planner route used to.
 *
 * DASH-PROPORTION (2026-06-05) — re-proportion pass. The previous 3-up
 * equal-column row left Streak floating in a large empty box and let
 * Activity grow taller than it needs to be. The trio now reads as one
 * clean rectangle:
 *   - On `md+`: a 3-column grid. The Calendar is the wide, tall column —
 *     it spans 2 of the 3 columns AND both rows (`md:col-span-2
 *     md:row-span-2`), so it's noticeably wider than before. The left
 *     column is a narrow single column that stacks Streak (row 1) over
 *     Activity (row 2). Each left cell is `h-full`, so the two shorter
 *     widgets together fill exactly the Calendar's height — Streak + the
 *     freshest-action Activity stacked = one tall Calendar beside them.
 *     `items-stretch` (the grid default) + `auto-rows-fr` keep the two
 *     left rows even halves, killing the empty Streak gap.
 *   - On `<md`: single-column stack — Streak (smallest, most
 *     reward-loaded), then Activity (freshest action), then Calendar.
 *
 * The cells stay verbatim; the wrapper `h-full` + the Card primitive's
 * `flex flex-col` body let each widget fill its grid cell without
 * rebuilding the widgets themselves.
 */
interface Props {
  calYear?: string;
  calMonth?: string;
}

export function DashboardWidgets({ calYear, calMonth }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 md:auto-rows-fr gap-4">
      {/* Streak — mobile order 1; desktop left column, top half. */}
      <div className="h-full md:col-start-1 md:row-start-1">
        <PlannerStreakCell />
      </div>
      {/* Activity — mobile order 2; desktop left column, bottom half. */}
      <div className="h-full md:col-start-1 md:row-start-2">
        <PlannerActivityCell />
      </div>
      {/* Calendar — the wide, tall column. Spans both other columns and
          both rows so it sets the rectangle's height; Streak + Activity
          stack to match it on the left. */}
      <div className="h-full md:col-start-2 md:col-span-2 md:row-start-1 md:row-span-2">
        <PlannerCalendarCell calYear={calYear} calMonth={calMonth} />
      </div>
    </div>
  );
}
