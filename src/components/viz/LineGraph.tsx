import { clsx } from "clsx";
import {
  VIZ_STROKE,
  vizGlow,
  type VizTone,
} from "./vizTokens";

/**
 * LineGraph / AreaGraph — the bespoke phosphor plot (DESIGN_LANGUAGE §13,
 * moodboard group 21: *"line graphs… the memory element could be good for
 * the color-map style"*). A hand-built SVG trend plot styled to the HUD:
 *
 *   - a faint dotted GRID (horizontal rules + the baseline),
 *   - a glowing phosphor PLOT LINE,
 *   - (AreaGraph) a low-alpha AREA FILL under the line,
 *   - plotted NODE dots at each datum so the series is readable at a
 *     glance with NO hover required (the spec's hard floor),
 *   - the latest node emphasised + an optional value caption.
 *
 * Pure SVG, SSR-safe (no refs / effects / window / document) — renders
 * identically server + client. The draw-on-mount animation is opt-in and
 * `motion-safe` only, so reduced-motion users see the final plot and SSR
 * markup is unaffected. The viewBox is a fixed 100×<aspect> user-space so
 * the component scales fluidly to its container width (`w-full`).
 */

export interface LineGraphProps {
  /** The series. ≥2 points draws a line; 1 point draws a single node;
   *  0 points renders the empty grid only. */
  data: ReadonlyArray<number>;
  /** Phosphor hue for the line + nodes + fill. Default "cyan". */
  tone?: VizTone;
  /** Render the low-alpha area fill under the line (AreaGraph mode). */
  area?: boolean;
  /** SVG user-space height. Width is fluid (viewBox 100 wide). Default 40. */
  height?: number;
  /** Number of horizontal grid rules (excluding the baseline). Default 3. */
  gridLines?: number;
  /** Draw the plotted node dots. Default true (readability floor). */
  nodes?: boolean;
  /** Animate the line draw-in on mount (motion-safe only). */
  animate?: boolean;
  /** Accessible description, e.g. "Activity over the last 60 days". */
  ariaLabel: string;
  className?: string;
}

const VIEW_W = 100;
const PAD_X = 2;
const PAD_Y = 4;

/** Project a series into SVG points within the padded viewBox. A flat or
 *  single-value series is centred on the mid-line so it never collapses to
 *  the floor. */
function project(
  data: ReadonlyArray<number>,
  height: number,
): Array<{ x: number; y: number }> {
  if (data.length === 0) return [];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min;
  const usableW = VIEW_W - PAD_X * 2;
  const usableH = height - PAD_Y * 2;
  return data.map((v, i) => {
    const x =
      data.length === 1
        ? VIEW_W / 2
        : PAD_X + (i / (data.length - 1)) * usableW;
    // Higher value sits higher on screen (smaller y). Flat series → mid.
    const norm = span === 0 ? 0.5 : (v - min) / span;
    const y = PAD_Y + (1 - norm) * usableH;
    return { x, y };
  });
}

export function LineGraph({
  data,
  tone = "cyan",
  area = false,
  height = 40,
  gridLines = 3,
  nodes = true,
  animate = true,
  ariaLabel,
  className,
}: LineGraphProps) {
  const stroke = VIZ_STROKE[tone];
  const points = project(data, height);
  const linePath =
    points.length >= 2
      ? points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")
      : "";
  const first = points[0];
  const last = points[points.length - 1];
  const areaPath =
    area && points.length >= 2 && first && last
      ? `${linePath} L${last.x.toFixed(2)} ${height - PAD_Y} L${first.x.toFixed(2)} ${height - PAD_Y} Z`
      : "";

  // Evenly spaced grid rules across the usable height + the baseline.
  const rules = Array.from({ length: Math.max(0, gridLines) }, (_, i) => {
    const t = (i + 1) / (gridLines + 1);
    return PAD_Y + t * (height - PAD_Y * 2);
  });

  const gradientId = `viz-area-${tone}`;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${VIEW_W} ${height}`}
      preserveAspectRatio="none"
      className={clsx("block w-full", className)}
      style={{ height }}
    >
      {area ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={stroke}
              stopOpacity={0.28}
            />
            <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
          </linearGradient>
        </defs>
      ) : null}

      {/* Faint grid — horizontal rules + a brighter baseline. */}
      <g>
        {rules.map((y, i) => (
          <line
            key={i}
            x1={PAD_X}
            y1={y}
            x2={VIEW_W - PAD_X}
            y2={y}
            stroke="var(--color-border)"
            strokeWidth={0.4}
            strokeDasharray="1 2"
            opacity={0.7}
          />
        ))}
        <line
          x1={PAD_X}
          y1={height - PAD_Y}
          x2={VIEW_W - PAD_X}
          y2={height - PAD_Y}
          stroke="var(--color-border-strong)"
          strokeWidth={0.5}
          opacity={0.8}
        />
      </g>

      {/* Area fill (AreaGraph mode) — low-alpha phosphor gradient. */}
      {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" /> : null}

      {/* Plot line — the glowing phosphor trace. vector-effect keeps the
          stroke a constant 1.5px despite the non-uniform viewBox scale. */}
      {linePath ? (
        <path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          className={animate ? "motion-safe:[animation:viz-draw_1100ms_ease-out]" : undefined}
          style={{ filter: vizGlow(stroke, 2, 50) }}
        />
      ) : null}

      {/* Node dots — readable without hover. The latest node is emphasised
          so the eye lands on "where we are now". */}
      {nodes
        ? points.map((p, i) => {
            const isLast = i === points.length - 1;
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={isLast ? 2 : 1.2}
                fill={isLast ? stroke : "var(--color-bg)"}
                stroke={stroke}
                strokeWidth={isLast ? 0 : 1}
                vectorEffect="non-scaling-stroke"
                style={isLast ? { filter: vizGlow(stroke, 2, 60) } : undefined}
              />
            );
          })
        : last
          ? (
            <circle
              cx={last.x}
              cy={last.y}
              r={2}
              fill={stroke}
              style={{ filter: vizGlow(stroke, 2, 60) }}
            />
          )
          : null}
    </svg>
  );
}

/** AreaGraph — LineGraph with the area fill on by default (group 21). */
export function AreaGraph(props: Omit<LineGraphProps, "area">) {
  return <LineGraph {...props} area />;
}
