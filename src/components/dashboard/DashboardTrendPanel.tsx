import { Card } from "@/components/ui/Card";
import { AreaGraph } from "@/components/viz/LineGraph";
import { Sparkline } from "@/components/viz/Sparkline";
import { SegmentedBar } from "@/components/viz/SegmentedBar";

/**
 * PHASE-1 viz — the DASHBOARD activity-trend panel (DESIGN_LANGUAGE §13).
 *
 * Sits between the KPI strip and the PROJECTS table, reading like moodboard
 * groups 20 + 27 (mission-control): a headline phosphor AREA GRAPH of real
 * activity-over-time (the dashboard's existing 60-day activity_log series,
 * gap-filled to a contiguous daily count — see `activityTrendSeries`), a
 * compact SPARKLINE of the recent slice, and a SEGMENTED OUTPUT-RATE bar
 * for average completion (group 27's "OUTPUT RATE" idiom — Ross's
 * favourite). All bespoke viz, token colours, glow on the active line only.
 *
 * Every number here is derived from data the dashboard already fetches; no
 * new query. The series is "events logged per day" (stage bumps, recipes,
 * paints, …) — the closest clean activity signal available without new
 * tracking infra. The card carries the same corner-ticks + coordinate
 * tech-label treatment as the KPI cards so the screen reads as one surface.
 */

interface Props {
  /** Contiguous daily-activity counts, oldest → newest (the full window). */
  trend: ReadonlyArray<number>;
  /** Days the full series spans (for the axis caption). */
  windowDays: number;
  /** Average completion 0–100 — drives the segmented output-rate bar. */
  avgCompletion: number;
}

export function DashboardTrendPanel({ trend, windowDays, avgCompletion }: Props) {
  const total = trend.reduce((a, b) => a + b, 0);
  // The sparkline reads the most-recent ~14-day slice so it answers "are we
  // trending up right now" without the whole window's noise.
  const recent = trend.slice(-14);
  const recentTotal = recent.reduce((a, b) => a + b, 0);
  const peak = trend.length ? Math.max(...trend) : 0;

  return (
    <Card
      title="ACTIVITY TREND"
      accentColor="cyan"
      ticks
      techLabel="LOG ▸ ACTIVITY"
      bodyClassName="space-y-4"
    >
      {/* Headline area graph — activity over the full window. */}
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
            EVENTS / DAY · LAST {windowDays}D
          </span>
          <span className="font-mono text-xs tabular-nums text-[var(--color-fg-subtle)]">
            {total} total · peak {peak}
          </span>
        </div>
        <AreaGraph
          data={trend}
          tone="cyan"
          height={64}
          ariaLabel={`Activity over the last ${windowDays} days — ${total} events logged, peak ${peak} in a day`}
        />
      </div>

      {/* Glanceable readouts row — recent sparkline + output-rate bar. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <p className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
              RECENT · 14D
            </p>
            <p className="font-mono text-base tabular-nums text-[var(--color-green)] glow-text-strong">
              {recentTotal}
              <span className="text-2xs uppercase tracking-wider text-[var(--color-fg-muted)] ml-1.5">
                events
              </span>
            </p>
          </div>
          <Sparkline
            data={recent}
            tone="green"
            width={96}
            height={28}
            ariaLabel={`Recent activity trend, last 14 days — ${recentTotal} events`}
            className="shrink-0"
          />
        </div>

        <div className="flex flex-col justify-center gap-1.5 min-w-0">
          <p className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
            OUTPUT RATE
          </p>
          <SegmentedBar
            value={avgCompletion}
            segments={12}
            tone="auto"
            readout={`${avgCompletion}%`}
            ariaLabel={`Average completion across projects, ${avgCompletion} percent`}
          />
        </div>
      </div>
    </Card>
  );
}
