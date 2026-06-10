"use client";

import { useId } from "react";
import { mixLayers, type GlazeLayer } from "@/lib/tools/layering/opticalMix";

/**
 * Two-circle optical-mix Venn for the Layering tool's glaze mode.
 *
 * Each circle is a transparent paint laid over a white primer; the lens
 * where they overlap is filled with the *predicted painted result*
 * (computed by mixLayers, not a CSS blend — so per-layer thinness is
 * honoured and magenta-under-yellow reads as warm amber, see
 * opticalMix.test.ts). Circles and the lens are click targets.
 */

export interface VennCircle extends GlazeLayer {
  /** Short caption shown under the circle (e.g. "UNDERCOAT"). */
  label: string;
}

interface Props {
  undercoat: VennCircle;
  top: VennCircle;
  /** Fired when a region is clicked, with that region's rendered hex. */
  onPick?: (region: "undercoat" | "top" | "result", hex: string) => void;
}

const W = 340;
const H = 220;
const R = 78;
const CY = 100;
const CX_A = 122; // undercoat (left)
const CX_B = 218; // top (right)

export function GlazeVenn({ undercoat, top, onPick }: Props) {
  const clip = useId().replace(/:/g, "");
  const glow = `glow-${clip}`;
  const clipA = `clipA-${clip}`;

  const undercoatFill = mixLayers([undercoat]);
  const topFill = mixLayers([top]);
  const resultFill = mixLayers([undercoat, top]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-[420px] mx-auto block"
      role="img"
      aria-label={`Undercoat ${undercoatFill} under ${topFill} produces ${resultFill}`}
    >
      <defs>
        <filter id={glow} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={clipA}>
          <circle cx={CX_A} cy={CY} r={R} />
        </clipPath>
      </defs>

      {/* Undercoat circle (left) */}
      <circle
        cx={CX_A}
        cy={CY}
        r={R}
        fill={undercoatFill}
        className="cursor-pointer"
        onClick={() => onPick?.("undercoat", undercoatFill)}
      />
      {/* Top-glaze circle (right) */}
      <circle
        cx={CX_B}
        cy={CY}
        r={R}
        fill={topFill}
        className="cursor-pointer"
        onClick={() => onPick?.("top", topFill)}
      />
      {/* Lens = intersection: circle B clipped to circle A, filled with the
          predicted layered result. Sits on top and owns the click. */}
      <g clipPath={`url(#${clipA})`}>
        <circle
          cx={CX_B}
          cy={CY}
          r={R}
          fill={resultFill}
          className="cursor-pointer"
          onClick={() => onPick?.("result", resultFill)}
        />
      </g>

      {/* Cyan phosphor outlines */}
      <g
        fill="none"
        stroke="var(--color-cyan)"
        strokeWidth={1.5}
        opacity={0.9}
        filter={`url(#${glow})`}
        pointerEvents="none"
      >
        <circle cx={CX_A} cy={CY} r={R} />
        <circle cx={CX_B} cy={CY} r={R} />
      </g>

      {/* Captions */}
      <g
        fontFamily="var(--font-mono)"
        fontSize={9}
        fill="var(--color-fg-muted)"
        textAnchor="middle"
        pointerEvents="none"
        style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        <text x={CX_A - 26} y={CY + R + 16}>{undercoat.label}</text>
        <text x={CX_B + 26} y={CY + R + 16}>{top.label}</text>
        <text x={(CX_A + CX_B) / 2} y={CY - R - 8} fill="var(--color-cyan)">
          RESULT
        </text>
      </g>
    </svg>
  );
}
