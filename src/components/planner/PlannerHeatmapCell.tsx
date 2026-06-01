import { Card } from "@/components/ui/Card";
import { currentUserId } from "@/lib/auth-stub";
import {
  getActivityByDay,
  type ActivityDay,
} from "@/db/queries/activityLog";
import {
  buildHeatmapCells,
  monthLabels,
  tooltipFor,
  type HeatmapIntensity,
} from "./plannerHeatmapHelpers";

/**
 * P14.6 - Heatmap widget.
 *
 * Renders a 90-cell grid (one per day, last 90 days) coloured by
 * activity count for that day. The cell intensity buckets are the
 * Ross-locked thresholds:
 *
 *   0   -> dark blank        (var(--color-panel) tint)
 *   1   -> light green
 *   2-4 -> mid green
 *   5+  -> bright green
 *
 * Layout:
 *   * Title row above the grid with 3-letter month labels.
 *   * 13 columns x 7 rows on md+ (the painter sees the full 90
 *     days as a tight rectangle). Cells are aspect-square so they
 *     stay readable on any width.
 *   * Mobile: the grid keeps its 13x7 shape but the wrapper
 *     allows horizontal scroll if the viewport is too narrow to
 *     render every cell at >= 6px wide. Adequate fallback per
 *     P14.6 brief.
 *
 * Async server component. Pulls its own data on no-args call so the
 * PLANNER section can stay as the unchanged `<PlannerHeatmapCell />`
 * mount. `days` + `now` props are test seams.
 */

interface Props {
  days?: ReadonlyArray<ActivityDay>;
  now?: Date;
}

const WINDOW_DAYS = 90;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

const INTENSITY_CLASS: Record<HeatmapIntensity, string> = {
  // Muted panel tint for blanks - matches the P14.2 scaffold strip
  // so the empty state reads identical until activity lands.
  none: "bg-[color-mix(in_srgb,var(--color-fg-muted)_15%,transparent)]",
  // Three brightness tiers of green via color-mix on --color-green.
  low: "bg-[color-mix(in_srgb,var(--color-green)_35%,var(--color-bg))]",
  mid: "bg-[color-mix(in_srgb,var(--color-green)_65%,var(--color-bg))]",
  high: "bg-[var(--color-green)]",
};

export async function PlannerHeatmapCell({ days, now }: Props = {}) {
  const referenceNow = now ?? new Date();
  const resolvedDays =
    days ??
    (await getActivityByDay(
      await currentUserId(),
      new Date(referenceNow.getTime() - WINDOW_MS),
    ));

  const cells = buildHeatmapCells(resolvedDays, referenceNow, WINDOW_DAYS);
  const labels = monthLabels(cells);

  // 13 cols x 7 rows = 91 - we render 90 and leave one blank slot
  // unfilled (the layout reads as a tight rectangle). The grid
  // template uses minmax so cells stay crisp at every width.
  const cols = Math.ceil(cells.length / 7);

  return (
    <Card title="HEATMAP" titleAs="h3" accentColor="yellow">
      <div className="frame p-3 space-y-2 overflow-x-auto">
        {/* Month label row - positioned over the grid columns. */}
        <div
          className="grid gap-[2px] text-[10px] font-sans text-[var(--color-fg-muted)] tracking-wide"
          style={{ gridTemplateColumns: "repeat(" + cols + ", minmax(8px, 1fr))" }}
          aria-hidden
        >
          {Array.from({ length: cols }).map((_, colIdx) => {
            const label = labels.find((l) => Math.floor(l.index / 7) === colIdx);
            return (
              <span key={colIdx} className="text-left">
                {label ? label.label : ""}
              </span>
            );
          })}
        </div>
        {/* The grid itself - 7 rows, cells stacked column-major. */}
        <div
          role="grid"
          aria-label={"Activity heatmap, last " + WINDOW_DAYS + " days"}
          className="grid gap-[2px]"
          style={{
            gridTemplateColumns: "repeat(" + cols + ", minmax(8px, 1fr))",
            gridTemplateRows: "repeat(7, minmax(0, 1fr))",
            gridAutoFlow: "column",
          }}
        >
          {cells.map((cell) => (
            <span
              key={cell.date}
              role="gridcell"
              title={tooltipFor(cell)}
              aria-label={tooltipFor(cell)}
              data-intensity={cell.intensity}
              className={
                "aspect-square rounded-[2px] " + INTENSITY_CLASS[cell.intensity]
              }
            />
          ))}
        </div>
        <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
          Your last {WINDOW_DAYS} days of painting. Hover or tap a cell
          for the count.
        </p>
      </div>
    </Card>
  );
}
