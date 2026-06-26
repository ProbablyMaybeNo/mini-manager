"use client";

import { Suspense } from "react";
import { ActivityFeed, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { useMockData } from "@/mock/MockProvider";
import { PlannerCalendar } from "@/components/dashboard/PlannerCalendar";

/**
 * DOP-005a — the real PLANNER page. FOCUS stays the painting bench (one model,
 * recipe, notes, timer); PLANNER is the distinct calendar surface: the month
 * grid + the events list/"+ Date" add-event + the activity tracker. Reuses the
 * exact PlannerCalendar (calendar + add-event) and ActivityFeed the dashboard
 * RightRail / mobile PlannerScreen compose, just given a full page's room.
 *
 * Client page reading `useMockData()` for events + activity — matches the
 * collection / focus pages (the (app) layout seeds the provider from the real
 * owner-scoped loadAppData, so this renders live data when signed in).
 */
function PlannerRoute() {
  const data = useMockData();

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <PageHeader
          title="PLANNER"
          tagline="// tournaments, deadlines & your hobby calendar"
        />

        {/* Calendar gets the lead column on desktop (it's the point of the
            page); the activity tracker rides alongside on lg+ and stacks
            beneath on phones. The calendar carries its own "+ Date" add-event
            form, so the page needs no extra event affordance. */}
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1">
            <Panel label="PLANNER" cornerTicks className="p-4">
              {/* The rail caps the grid to a glanceable 170px; on a dedicated
                  page the month deserves real estate, so widen the cap. */}
              <PlannerCalendar
                events={data.events}
                calendarClassName="mx-auto w-full max-w-[420px]"
              />
            </Panel>
          </div>
          <div className="w-full shrink-0 lg:w-[320px]">
            <Panel label="ACTIVITY TRACKER" className="p-4">
              <div className="max-h-[60dvh] overflow-y-auto pr-1 pt-1">
                <ActivityFeed entries={data.activity} />
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlannerPage() {
  // useMockData is provider-backed (no Suspense needed), but the page sits in
  // the same Suspense shell as its siblings for consistency / future
  // useSearchParams use.
  return (
    <Suspense fallback={null}>
      <PlannerRoute />
    </Suspense>
  );
}
