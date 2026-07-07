"use client";

import { useId } from "react";
import { DEFAULT_SUBSTRATE, type GlazeLayer } from "@/lib/tools/layering/opticalMix";
import { computeVennFills } from "@/lib/tools/layering/venn";

/**
 * N-circle optical-mix Venn for the Stacking tool (Wave 2 rebuild —
 * ESVDHH6Wg78p). There's no more "undercoat" — every layer is just
 * "LAYER #", renderable from a single layer up. Each layer gets its own
 * circle showing that layer alone over the substrate; the centre where
 * EVERY circle overlaps is filled with the full stacked result (computed by
 * `computeVennFills`, not a CSS blend — so per-layer thinness is honoured
 * and a thin magenta under a solid yellow reads as warm amber, not average
 * grey). Circles and the centre are click targets that report their
 * rendered hex.
 */

export interface VennLayer extends GlazeLayer {
  id: string;
  /** Short caption shown under the circle (e.g. "LAYER 1"). */
  label: string;
}

interface Props {
  /** Bottom → top stacking order. Renders from 1 layer up. */
  layers: ReadonlyArray<VennLayer>;
  /** Primer/substrate every layer sits over. Defaults to white. */
  substrate?: string;
  /** Fired when a layer circle (or the centre result) is clicked. */
  onPick?: (target: { kind: "layer"; index: number } | { kind: "result" }, hex: string) => void;
}

const W = 360;
const H = 240;
const CX = 180;
const CY = 116;
const R = 72;

/** Circle centres for N layers, evenly spaced on a ring around (CX, CY) so
 *  they always share a common central overlap. A single layer sits dead
 *  centre; more layers spread further out (still overlapping) so the outline
 *  of each circle stays legible. */
function layoutCenters(n: number): Array<{ x: number; y: number }> {
  if (n <= 1) return [{ x: CX, y: CY }];
  const spread = n === 2 ? R * 0.62 : R * 0.85;
  return Array.from({ length: n }, (_, i) => {
    const angle = ((-90 + (360 / n) * i) * Math.PI) / 180;
    return { x: CX + spread * Math.cos(angle), y: CY + spread * Math.sin(angle) };
  });
}

export function GlazeVenn({ layers, substrate = DEFAULT_SUBSTRATE, onPick }: Props) {
  const uid = useId().replace(/:/g, "");
  const glow = `glow-${uid}`;
  const n = layers.length;
  const centers = layoutCenters(n);
  const { soloFills, resultFill } = computeVennFills(layers, substrate);

  // Build the "every circle overlaps here" centre region by nesting a
  // clip-path per circle — each nested <g> further restricts the visible
  // area to inside that circle too, so the innermost content only shows
  // through the intersection of all N circles.
  let center: React.ReactNode = (
    <circle
      cx={CX}
      cy={CY}
      r={R * 1.4}
      fill={resultFill}
      className={onPick ? "cursor-pointer" : undefined}
      onClick={() => onPick?.({ kind: "result" }, resultFill)}
    />
  );
  for (let i = 0; i < n; i++) {
    center = <g clipPath={`url(#${uid}-c${i})`}>{center}</g>;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mx-auto block w-full max-w-[420px]"
      role="img"
      aria-label={`${n} layer${n === 1 ? "" : "s"} — result ${resultFill}`}
    >
      <defs>
        <filter id={glow} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {centers.map((c, i) => (
          <clipPath id={`${uid}-c${i}`} key={i}>
            <circle cx={c.x} cy={c.y} r={R} />
          </clipPath>
        ))}
      </defs>

      {/* One solo circle per layer — that layer alone over the substrate. */}
      {layers.map((layer, i) => (
        <circle
          key={layer.id}
          cx={centers[i]!.x}
          cy={centers[i]!.y}
          r={R}
          fill={soloFills[i]}
          className="cursor-pointer"
          onClick={() => onPick?.({ kind: "layer", index: i }, soloFills[i]!)}
        />
      ))}

      {/* The centre — every circle's intersection — filled with the full
          stacked result. */}
      {center}

      {/* Cyan phosphor outlines */}
      <g
        fill="none"
        stroke="var(--color-cyan)"
        strokeWidth={1.5}
        opacity={0.9}
        filter={`url(#${glow})`}
        pointerEvents="none"
      >
        {centers.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={R} />
        ))}
      </g>

      {/* Captions */}
      <g
        fontFamily="var(--font-osd)"
        fontSize={9}
        fill="var(--color-fg-faint)"
        textAnchor="middle"
        pointerEvents="none"
        style={{ textTransform: "uppercase", letterSpacing: "0.15em" }}
      >
        {layers.map((layer, i) => (
          <text key={layer.id} x={centers[i]!.x} y={centers[i]!.y + R + 16}>
            {layer.label}
          </text>
        ))}
        <text x={CX} y={CY - R - 10} fill="var(--color-cyan)">
          RESULT
        </text>
      </g>
    </svg>
  );
}
