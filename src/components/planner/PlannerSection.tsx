import { Card } from "@/components/ui/Card";
import { PlannerActivityCell } from "./PlannerActivityCell";
import { PlannerCalendarCell } from "./PlannerCalendarCell";
import { HeatSinkGridCell } from "./HeatSinkGridCell";
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
 * Layout (A3 — 2026-06-03 swap):
 *   - On `md+`: 5-column grid. The COLLECTION square takes the left 3
 *     cols across all 4 rows (square-aspect — it's the hero now), and
 *     the right 2 cols stack Activity → Streak → Calendar → Inspo (one
 *     cell per row). The calendar moved out of the big left cell into a
 *     MUCH smaller widget below the streak box. Implemented via
 *     `md:col-start` + `md:row-start` so the mobile reorder doesn't
 *     bleed into desktop.
 *   - On `<md`: single-column stack, reordered to Streak → Activity →
 *     Collection → Calendar → Inspo. Streak first because it's the
 *     smallest + most reward-loaded — the painter sees their number
 *     before they scroll. Activity next so the freshest action is
 *     immediately readable. Collection third (the hero square). Calendar
 *     fourth (now a small widget). Inspo closes the scroll.
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
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* COLLECTION square (P16.3 HeatSink) — A3: now the hero, in the
            big left cell where the calendar used to live. Spans 3 cols ×
            4 rows on the left and is square-aspect on md+ so the painter
            reads their whole library as one compact gamut square. Mobile
            order 3 (the hero, below the reward-loaded streak + activity). */}
        <div className="order-3 md:order-none md:col-span-3 md:col-start-1 md:row-start-1 md:row-span-4 md:aspect-square">
          <HeatSinkGridCell />
        </div>
        {/* Streak — mobile order 1 (smallest, most reward-loaded),
            desktop row 2 of the right column. */}
        <div className="order-1 md:order-none md:col-span-2 md:col-start-4 md:row-start-2">
          <PlannerStreakCell />
        </div>
        {/* Activity — mobile order 2, desktop row 1 of the right
            column (freshest action sits at the top of the stack). */}
        <div className="order-2 md:order-none md:col-span-2 md:col-start-4 md:row-start-1">
          <PlannerActivityCell />
        </div>
        {/* Calendar — A3: demoted from the big left cell to a MUCH
            smaller widget below the streak box. Mobile order 4, desktop
            row 3 of the right column. */}
        <div className="order-4 md:order-none md:col-span-2 md:col-start-4 md:row-start-3">
          <PlannerCalendarCell calYear={calYear} calMonth={calMonth} />
        </div>
        {/* Inspo — mobile order 5, desktop row 4 of the right column. */}
        <div className="order-5 md:order-none md:col-span-2 md:col-start-4 md:row-start-4">
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
