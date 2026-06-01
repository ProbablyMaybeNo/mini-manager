import { Card } from "@/components/ui/Card";
import { PlannerActivityCell } from "./PlannerActivityCell";
import { PlannerCalendarCell } from "./PlannerCalendarCell";
import { PlannerHeatmapCell } from "./PlannerHeatmapCell";
import { PlannerInspoCell } from "./PlannerInspoCell";
import { PlannerStreakCell } from "./PlannerStreakCell";

/**
 * P14.2 — Dashboard PLANNER section.
 *
 * Sits between the FOCUS section (P13.11) and the projects dashboard
 * table on /projects. Section title is the literal "PLANNER" string
 * Ross signed off on — locked, do NOT rename to Campaign / Studio /
 * HQ etc.
 *
 * Layout:
 *   - On `md+`: two-column responsive grid. Calendar takes the left
 *     ~60% (3 of 5 cols), the right column stacks Activity → Streak
 *     → Heatmap → Inspo.
 *   - On mobile: single full-width stack in reading order. P14.8
 *     does the proper mobile responsiveness pass once the real
 *     widgets land — for the scaffold we just stack everything.
 *
 * Every cell is a sibling component the P14.3–7 widget builders can
 * replace one at a time without touching this composite or
 * src/app/projects/page.tsx. Empty-state copy is permanent — even
 * once the real widgets ship, an "no data yet" view re-uses the
 * same wording.
 *
 * P14.3 — Calendar cell is now an async server component that reads
 * the `?calYear` / `?calMonth` search params for prev / next month
 * nav. We thread them through this composite so the section stays
 * the single mount point on the page.
 */
interface Props {
  /** P14.3 — `?calYear` / `?calMonth` search-param values driving
   *  the calendar widget's prev / next month nav. */
  calYear?: string;
  calMonth?: string;
}

export async function PlannerSection({ calYear, calMonth }: Props = {}) {
  return (
    <Card title="PLANNER" accentColor="amber">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3">
          <PlannerCalendarCell calYear={calYear} calMonth={calMonth} />
        </div>
        <div className="md:col-span-2 grid grid-cols-1 gap-4">
          <PlannerActivityCell />
          <PlannerStreakCell />
          <PlannerHeatmapCell />
          <PlannerInspoCell />
        </div>
      </div>
    </Card>
  );
}
