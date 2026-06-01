import { Card } from "@/components/ui/Card";
import { currentUserId } from "@/lib/auth-stub";
import {
  getActivityByDay,
  type ActivityDay,
} from "@/db/queries/activityLog";
import {
  computeStreak,
  microcopyFor,
} from "./plannerStreakHelpers";

/**
 * P14.5 - Streak counter widget.
 *
 * Derives a consecutive-day streak from the painter's last-60-days
 * activity_log rows (`stage_bump` + `recipe_created` qualify).
 *
 * States + microcopy:
 *   streak >= 7  -> "On a {N}-day painting streak - keep it up."
 *   streak >= 1  -> "{N} days - don't break the chain."
 *   streak 0,
 *     last paint
 *     <= 3 days  -> "Last paint: {N} days ago - break it open."
 *   never        -> "Bump a stage to start your streak."
 *
 * Async server component. Pulls its own data on no-args call so the
 * PLANNER section can stay as the unchanged `<PlannerStreakCell />`
 * mount the P14.2 scaffold + P14.3 commit already laid down.
 * Accepts `days` + `now` props as test seams.
 */

interface Props {
  /** Optional explicit ActivityDay list (newest-first). When omitted
   *  the cell pulls last-60-days for the current user. */
  days?: ReadonlyArray<ActivityDay>;
  /** "Today" anchor for the streak compute. Tests pin this so the
   *  rendered output is deterministic. */
  now?: Date;
}

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

export async function PlannerStreakCell({ days, now }: Props = {}) {
  const referenceNow = now ?? new Date();
  const resolvedDays =
    days ??
    (await getActivityByDay(
      await currentUserId(),
      new Date(referenceNow.getTime() - SIXTY_DAYS_MS),
    ));

  const result = computeStreak(resolvedDays, referenceNow);
  const copy = microcopyFor(result);

  // Accent green when the streak is hot (7+); amber when active
  // but fragile (1-6); muted when broken or absent. Status colour
  // discipline only - no Button affordance.
  const isHot = result.streak >= 7;
  const isActive = result.streak >= 1;
  const numberColor = isHot
    ? "text-[var(--color-green)]"
    : isActive
      ? "text-[var(--color-amber)]"
      : "text-[var(--color-fg-muted)]";
  const unitLabel = result.streak === 1 ? "DAY" : "DAYS";
  const ariaUnit = result.streak === 1 ? "day" : "days";

  return (
    <Card title="STREAK" titleAs="h3" accentColor="purple">
      <div className="frame p-3 space-y-2">
        <div className="flex items-baseline gap-2">
          <span
            className={"text-3xl tabular-nums tracking-wide font-medium " + numberColor}
            aria-label={result.streak + " " + ariaUnit}
          >
            {result.streak}
          </span>
          <span className="text-xs font-sans text-[var(--color-fg-muted)] uppercase tracking-wide">
            {unitLabel}
          </span>
        </div>
        <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
          {copy}
        </p>
      </div>
    </Card>
  );
}
