import { clsx } from "clsx";
import { VIZ_STROKE, vizGlow, type VizTone } from "./vizTokens";

/**
 * WireframeGlobe — the signature dashboard HERO (DESIGN_LANGUAGE §13,
 * moodboard group 20: josh-floyd "cyberspace", *"radial menus like the
 * terminal access element"* + the wireframe-globe / radar module). This is
 * the bespoke counterpart to the sign-in CRT logo art: where that screen is
 * carried by hand-built phosphor illustration, the dashboard now gets its
 * own signature piece so the "wow" isn't on the gauges alone.
 *
 * The piece is a wireframe globe seen as a radar scope —
 *
 *   - a TICK RING of graduations around the rim (the diegetic bezel),
 *   - the GLOBE itself: an outer rim + latitude rings (flattened ellipses)
 *     + longitude meridians, all faint phosphor grid lines,
 *   - a glowing RADAR SWEEP — a translucent wedge + a bright leading edge
 *     from the centre, the one element that carries the bloom,
 *   - a handful of DATA BLIPS pinned on the grid (the "contacts"), the
 *     brightest with a restrained halo.
 *
 * Pure SVG, SSR-safe (no refs / effects / window / document at module or
 * render scope) so it renders identically on the server and client — it is
 * a server component and the static markup is a COMPLETE, legible frame on
 * its own. The sweep rotation is opt-in and applied via CSS `motion-safe`
 * only, so reduced-motion users (and SSR) get the finished still frame with
 * no movement. Decorative by contract: it carries an `img` role + label but
 * conveys no data the rest of the dashboard doesn't already state.
 *
 * Token colours only (the 5 locked phosphor tokens via `VIZ_STROKE`), glow
 * restrained to the active sweep + the hot blip, readability is the floor.
 */

export interface WireframeGlobeProps {
  /** Outer square size in px (the SVG is square; the panel scales it). */
  size?: number;
  /** Primary grid/sweep hue. Default "cyan" (the terminal-access tone). */
  tone?: VizTone;
  /** Accent hue for the data blips. Default "green". */
  blipTone?: VizTone;
  /** Number of meridian (longitude) lines. Default 7. */
  meridians?: number;
  /** Number of latitude rings (excluding equator). Default 3. */
  latitudes?: number;
  /** Number of rim tick graduations. Default 48. */
  ticks?: number;
  /** Rotate the radar sweep on mount (motion-safe only). Default true. */
  animate?: boolean;
  /** Accessible name. Defaults to a generic radar-scope description. */
  ariaLabel?: string;
  className?: string;
}

/** A blip is placed in normalised dial space: angle (deg, 0 = up,
 *  clockwise) + radius (0 = centre, 1 = rim). `hot` blips carry a halo. */
interface Blip {
  angle: number;
  radius: number;
  hot?: boolean;
}

// A fixed, hand-placed contact set so the still frame is deterministic and
// composed (not random) — SSR-stable and reviewable by eye.
const BLIPS: readonly Blip[] = [
  { angle: 34, radius: 0.58, hot: true },
  { angle: 112, radius: 0.78 },
  { angle: 158, radius: 0.4 },
  { angle: 205, radius: 0.66 },
  { angle: 268, radius: 0.5 },
  { angle: 318, radius: 0.82 },
];

export function WireframeGlobe({
  size = 320,
  tone = "cyan",
  blipTone = "green",
  meridians = 7,
  latitudes = 3,
  ticks = 48,
  animate = true,
  ariaLabel,
  className,
}: WireframeGlobeProps) {
  const stroke = VIZ_STROKE[tone];
  const blipStroke = VIZ_STROKE[blipTone];

  const center = size / 2;
  // The globe rim sits a hair inside the tick ring so the graduations frame
  // the sphere rather than collide with it.
  const tickOuter = center - 2;
  const rim = center - size * 0.08;

  // Tick ring — alternating major/minor graduations around the rim.
  const tickCount = Math.max(8, Math.round(ticks));
  const tickMarks = Array.from({ length: tickCount }, (_, i) => {
    const isMajor = i % 4 === 0;
    const angle = (i / tickCount) * 2 * Math.PI - Math.PI / 2;
    const inner = tickOuter - size * (isMajor ? 0.05 : 0.028);
    return {
      key: i,
      x1: center + Math.cos(angle) * tickOuter,
      y1: center + Math.sin(angle) * tickOuter,
      x2: center + Math.cos(angle) * inner,
      y2: center + Math.sin(angle) * inner,
      isMajor,
    };
  });

  // Latitude rings — flattened ellipses stacked up/down from the equator so
  // the flat circle reads as a sphere. Each ring's vertical radius shrinks
  // toward the poles; the horizontal radius follows the sphere's silhouette.
  const latCount = Math.max(0, Math.round(latitudes));
  const latRings = Array.from({ length: latCount }, (_, i) => {
    // fraction up the hemisphere (0 = equator-adjacent, 1 = near pole)
    const f = (i + 1) / (latCount + 1);
    const ry = rim * Math.cos((f * Math.PI) / 2) * 0.42; // ellipse flatten
    const rx = rim * Math.sqrt(1 - f * f); // silhouette width at this lat
    const dy = rim * Math.sin((f * Math.PI) / 2);
    return { key: i, rx, ry, dy };
  });

  // Meridian (longitude) lines — ellipses through both poles, rotated about
  // the vertical axis. We fake the rotation by varying the ellipse's
  // horizontal radius (a meridian seen edge-on is a line; face-on is the
  // full rim). Symmetric set about the centre meridian.
  const merCount = Math.max(1, Math.round(meridians));
  const meridianLines = Array.from({ length: merCount }, (_, i) => {
    const t = merCount === 1 ? 0.5 : i / (merCount - 1); // 0..1
    const rx = Math.abs(Math.cos((t - 0.5) * Math.PI)) * rim;
    return { key: i, rx };
  });

  // Data blips — convert normalised polar to SVG coords.
  const blips = BLIPS.map((b, i) => {
    const a = (b.angle * Math.PI) / 180 - Math.PI / 2;
    const r = b.radius * rim;
    return {
      key: i,
      cx: center + Math.cos(a) * r,
      cy: center + Math.sin(a) * r,
      hot: Boolean(b.hot),
    };
  });

  // Radar sweep wedge — a translucent triangle from the centre to the rim,
  // with a bright leading edge. The wedge spans ~38°; the bright edge is its
  // trailing (newest) side. Drawn pointing up at rest; the whole sweep group
  // rotates on mount (motion-safe) so the still frame is a fixed wedge.
  const sweepDeg = 38;
  const edgeA = -Math.PI / 2; // straight up
  const trailA = edgeA + (sweepDeg * Math.PI) / 180;
  const wedgePath = `M ${center} ${center} L ${
    center + Math.cos(edgeA) * rim
  } ${center + Math.sin(edgeA) * rim} A ${rim} ${rim} 0 0 1 ${
    center + Math.cos(trailA) * rim
  } ${center + Math.sin(trailA) * rim} Z`;
  const edgeX = center + Math.cos(edgeA) * rim;
  const edgeY = center + Math.sin(edgeA) * rim;

  const gridStroke = `color-mix(in srgb, ${stroke} 38%, transparent)`;
  const rimStroke = `color-mix(in srgb, ${stroke} 70%, transparent)`;
  const sweepFillId = `wfg-sweep-${tone}`;

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? "Radar scope — wireframe globe with sweep"}
      className={clsx("inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <defs>
          {/* Sweep wedge fades from a faint centre to nothing at the rim. */}
          <radialGradient id={sweepFillId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.0} />
            <stop offset="55%" stopColor={stroke} stopOpacity={0.16} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
          </radialGradient>
        </defs>

        {/* Rim tick graduations — the diegetic bezel. Drawn upright so SSR
            markup is deterministic. */}
        <g>
          {tickMarks.map((t) => (
            <line
              key={t.key}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={
                t.isMajor
                  ? "color-mix(in srgb, var(--color-cyan) 45%, var(--color-border-strong))"
                  : "var(--color-border-strong)"
              }
              strokeWidth={t.isMajor ? 1.5 : 1}
              opacity={t.isMajor ? 0.9 : 0.5}
            />
          ))}
        </g>

        {/* The globe grid — outer rim, latitude rings, meridians, axes. */}
        <g>
          {/* Outer rim */}
          <circle
            cx={center}
            cy={center}
            r={rim}
            fill="none"
            stroke={rimStroke}
            strokeWidth={1.4}
          />
          {/* Equator (the widest latitude) */}
          <ellipse
            cx={center}
            cy={center}
            rx={rim}
            ry={rim * 0.34}
            fill="none"
            stroke={gridStroke}
            strokeWidth={1}
          />
          {/* Latitude rings, mirrored above + below the equator */}
          {latRings.map((l) => (
            <g key={l.key}>
              <ellipse
                cx={center}
                cy={center - l.dy}
                rx={l.rx}
                ry={l.ry}
                fill="none"
                stroke={gridStroke}
                strokeWidth={1}
                opacity={0.85}
              />
              <ellipse
                cx={center}
                cy={center + l.dy}
                rx={l.rx}
                ry={l.ry}
                fill="none"
                stroke={gridStroke}
                strokeWidth={1}
                opacity={0.85}
              />
            </g>
          ))}
          {/* Meridians — ellipses through the poles at varying face-angles */}
          {meridianLines.map((m) => (
            <ellipse
              key={m.key}
              cx={center}
              cy={center}
              rx={m.rx}
              ry={rim}
              fill="none"
              stroke={gridStroke}
              strokeWidth={1}
              opacity={0.7}
            />
          ))}
          {/* Cross-hair axes through the centre */}
          <line
            x1={center}
            y1={center - rim}
            x2={center}
            y2={center + rim}
            stroke={gridStroke}
            strokeWidth={1}
            opacity={0.5}
          />
          <line
            x1={center - rim}
            y1={center}
            x2={center + rim}
            y2={center}
            stroke={gridStroke}
            strokeWidth={1}
            opacity={0.5}
          />
        </g>

        {/* Radar sweep — the one element carrying the bloom. The whole group
            rotates on mount (motion-safe); the still frame is a fixed wedge
            pointing up. transform-origin is the SVG centre. */}
        <g
          className={
            animate
              ? "motion-safe:[animation:wfg-sweep_8s_linear_infinite]"
              : undefined
          }
          style={{ transformOrigin: "center" }}
        >
          <path d={wedgePath} fill={`url(#${sweepFillId})`} />
          {/* Bright leading edge */}
          <line
            x1={center}
            y1={center}
            x2={edgeX}
            y2={edgeY}
            stroke={stroke}
            strokeWidth={1.6}
            strokeLinecap="round"
            style={{ filter: vizGlow(stroke, 4, 60) }}
          />
        </g>

        {/* Data blips — composed contacts pinned on the grid. The hot blip
            carries a restrained halo; the rest are plain dots. */}
        <g>
          {blips.map((b) => (
            <g key={b.key}>
              {b.hot ? (
                <circle
                  cx={b.cx}
                  cy={b.cy}
                  r={5.5}
                  fill="none"
                  stroke={blipStroke}
                  strokeWidth={1}
                  opacity={0.55}
                  className={
                    animate
                      ? "motion-safe:[animation:wfg-ping_2.6s_ease-out_infinite]"
                      : undefined
                  }
                  style={{ transformOrigin: `${b.cx}px ${b.cy}px` }}
                />
              ) : null}
              <circle
                cx={b.cx}
                cy={b.cy}
                r={b.hot ? 2.6 : 1.8}
                fill={blipStroke}
                style={
                  b.hot ? { filter: vizGlow(blipStroke, 3, 60) } : undefined
                }
              />
            </g>
          ))}
        </g>

        {/* Centre hub */}
        <circle cx={center} cy={center} r={2.4} fill={rimStroke} />
      </svg>
    </span>
  );
}
