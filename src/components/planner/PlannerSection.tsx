import { Card } from "@/components/ui/Card";
import { PlannerActivityCell } from "./PlannerActivityCell";
import { PlannerCalendarCell } from "./PlannerCalendarCell";
import { PlannerInspoCell } from "./PlannerInspoCell";
import { PlannerStreakCell } from "./PlannerStreakCell";

/**
 * P14.2 — Dashboard PLANNER section.
 * P14.8 — Mobile responsiveness pass: cells flatten into a single grid
 *         so we can reorder them on mobile via `order-*` while keeping
 *         the desktop two-column nested-stack visual unchanged.
 *
 * Sits between the FOCUS section (P13.11) and the projects dashboard
 * table on /projects. Section title is the literal "PLANNER" string
 * Ross signed off on — locked, do NOT rename to Campaign / Studio /
 * HQ etc.
 *
 * Layout (LIB-COLORMAP — 2026-06-04): the COLLECTION colour map moved to
 * the /library right-hand panel, so the PLANNER drops to four cells —
 * Activity, Streak, Calendar, Inspo.
 *   - On `md+`: a balanced 2-column grid. Left column stacks Activity
 *     (freshest action, top) → Calendar (the small month widget). Right
 *     column stacks Streak (reward-loaded counter, top) → Inspo (the
 *     reference board). Row pinning via `md:col-start` + `md:row-start`
 *     keeps the mobile reorder from bleeding into desktop.
 *   - On `<md`: single-column stack, reordered to Streak → Activity →
 *     Calendar → Inspo. Streak first because it's the smallest + most
 *     reward-loaded — the painter sees their number before they scroll.
 *     Activity next so the freshest action is immediately readable.
 *     Calendar third (the small month widget). Inspo closes the scroll.
 *
 * Every cell is a sibling component the P14.3–7 widget builders can
 * replace one at a time without touching this composite or
 * src/app/projects/page.tsx.
 *
 * P14.3 — Calendar cell is an async server component that reads the
 * `?calYear` / `?calMonth` search params for prev / next month nav.
 * We thread them through this composite so the section stays the
 * single mount point on the page.
 */
interface Props {
  /** P14.3 — `?calYear` / `?calMonth` search-param values driving
   *  the calendar widget's prev / next month nav. */
  calYear?: string;
  calMonth?: string;
  /** M4 — when the cluster is mounted inside a container that already
   *  supplies its own "PLANNER" header (the mobile collapsed disclosure
   *  on /projects), skip the wrapping Card so the header isn't drawn
   *  twice. Defaults to false: the standalone /planner route + any
   *  legacy mount keep the bordered Card chrome. */
  bare?: boolean;
}

export async function PlannerSection({
  calYear,
  calMonth,
  bare = false,
}: Props = {}) {
  const grid = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Streak — mobile order 1 (smallest, most reward-loaded);
            desktop right column, row 1. */}
        <div className="order-1 md:order-none md:col-start-2 md:row-start-1">
          <PlannerStreakCell />
        </div>
        {/* Activity — mobile order 2; desktop left column, row 1
            (freshest action sits at the top of the stack). */}
        <div className="order-2 md:order-none md:col-start-1 md:row-start-1">
          <PlannerActivityCell />
        </div>
        {/* Calendar — the small month widget. Mobile order 3; desktop
            left column, row 2. */}
        <div className="order-3 md:order-none md:col-start-1 md:row-start-2">
          <PlannerCalendarCell calYear={calYear} calMonth={calMonth} />
        </div>
        {/* Inspo — the reference board. Mobile order 4; desktop right
            column, row 2. */}
        <div className="order-4 md:order-none md:col-start-2 md:row-start-2">
          <PlannerInspoCell />
        </div>
    </div>
  );

  // M4 — bare mount (inside the mobile collapsed disclosure): the
  // container owns the "PLANNER" header, so render just the grid.
  if (bare) return grid;

  return (
    // P14.8 — tighter outer body padding on mobile so the nested
    // Card-in-Card chrome doesn't eat all the calendar grid width.
    // !-overrides beat the global .card-body media-query padding.
    <Card
      title="PLANNER"
      accentColor="amber"
      bodyClassName="!p-2 sm:!p-3.5"
    >
      {grid}
    </Card>
  );
}
