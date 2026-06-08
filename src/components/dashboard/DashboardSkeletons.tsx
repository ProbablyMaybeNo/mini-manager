import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import type { CardAccent } from "@/components/ui/Card";

/**
 * DASH-SKELETON (2026-06-05) — in-theme loading skeletons for the async
 * dashboard widget cells (doc §10: "Loading = skeleton screens that
 * mirror the final layout").
 *
 * The Activity + Calendar cells are async server components; wrapped in
 * <Suspense> on the dashboard, these placeholders render on first paint
 * instead of a flash of empty cards or a generic spinner. Each skeleton
 * reuses the Card primitive (same header bar + accent + height) so the
 * layout doesn't shift when real data lands.
 *
 * The shimmer is `motion-safe:animate-pulse` — phosphor-friendly low
 * contrast bars on the panel surface, and it goes fully static under
 * `prefers-reduced-motion` (CRT-aesthetic restraint, doc §13). No grey
 * library shimmer: bars are token-coloured (`--color-bg-elevated` on
 * `--color-bg-panel`).
 */

/** A single token-styled placeholder bar. */
function Bar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={
        "block rounded-sm bg-[var(--color-bg-elevated)] motion-safe:animate-pulse " +
        (className ?? "")
      }
    />
  );
}

function SkeletonCard({
  title,
  accentColor,
  techLabel,
  children,
  bodyClassName,
}: {
  title: string;
  accentColor: CardAccent;
  /** Matches the loaded cell's terminal tech label so the frame is
   *  identical before + after the data lands (no chrome shift). */
  techLabel: string;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <Card
      title={title}
      titleAs="h3"
      accentColor={accentColor}
      ticks
      techLabel={techLabel}
      className="h-full"
      bodyClassName={bodyClassName ?? "flex-1 flex flex-col"}
      ariaLabel={`${title} loading`}
    >
      <div role="status" aria-live="polite" data-skeleton>
        <span className="sr-only">Loading {title.toLowerCase()}…</span>
        {children}
      </div>
    </Card>
  );
}

/** Mirrors PlannerActivityCell: a vertical list of event lines. */
export function ActivitySkeleton() {
  return (
    <SkeletonCard title="ACTIVITY" accentColor="green" techLabel="LOG ▸ FEED">
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Bar className="w-4 h-4 shrink-0" />
            <Bar className="h-3 flex-1" />
            <Bar className="w-8 h-3 shrink-0" />
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}

/** Mirrors PlannerUpcomingEventsCell: a short vertical list of upcoming
 *  events (kind-dot + name + countdown). DASHBOARD-POLISH (fix #4). */
export function EventsSkeleton() {
  return (
    <SkeletonCard title="EVENTS" accentColor="cyan" techLabel="CAL ▸ NEXT">
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Bar className="w-2 h-2 shrink-0 rounded-full" />
            <Bar className="h-3 flex-1" />
            <Bar className="w-8 h-3 shrink-0" />
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}

/** Mirrors PlannerCalendarCell: an intro line + a 7-col month grid.
 *  DASHBOARD-REDESIGN — titled PLANNER to match the relocated, compact +
 *  scrollable right-rail calendar cell so the frame is identical before
 *  and after the data lands. */
export function CalendarSkeleton() {
  return (
    <SkeletonCard
      title="PLANNER"
      accentColor="amber"
      techLabel="CAL ▸ MONTH"
      bodyClassName="!p-2 sm:!p-3 max-h-[24rem] overflow-y-auto"
    >
      <div className="space-y-3">
        <Bar className="h-3 w-3/4" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }).map((_, i) => (
            <Bar key={i} className="aspect-square w-full" />
          ))}
        </div>
      </div>
    </SkeletonCard>
  );
}
