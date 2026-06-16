"use client";

import { useMemo, useRef, useState } from "react";
import { hslToHex } from "@/lib/tools/wheel/harmonies";

/**
 * Pixel / retro rainbow hue wheel (DESIGN_LANGUAGE §7.3 "pixel color-wheel
 * upgrade"; Vercel thread DJIASK "more pixels, less blocky"). The ring is
 * rasterised into a fine grid of square pixel cells, each filled by the hue
 * at its angle (quantised into stepped bands) with a chunky pixel cursor.
 * Pointer + keyboard driven; emits hue degrees. Ported from the old shared
 * ColorPicker's WheelRing.
 */

const WHEEL_SIZE = 200;
const WHEEL_PX = 5;
const WHEEL_RING_CELLS = 9;
const WHEEL_HUE_STEPS = 60;

export function PixelWheelRing({
  hue,
  onChange,
}: {
  hue: number;
  onChange: (h: number) => void;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const size = WHEEL_SIZE;
  const radius = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;

  const computeHue = (clientX: number, clientY: number): number | null => {
    const svg = ref.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const sx = rect.width ? size / rect.width : 1;
    const sy = rect.height ? size / rect.height : 1;
    const x = (clientX - rect.left) * sx - cx;
    const y = (clientY - rect.top) * sy - cy;
    let deg = (Math.atan2(y, x) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const next = computeHue(e.clientX, e.clientY);
    if (next == null) return;
    setDragging(true);
    onChange(next);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const next = computeHue(e.clientX, e.clientY);
    if (next == null) return;
    onChange(next);
  };
  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setDragging(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const pixels = useMemo(() => {
    const innerR = radius - WHEEL_PX * WHEEL_RING_CELLS;
    const outerR = radius;
    const cells: { x: number; y: number; fill: string }[] = [];
    for (let gy = 0; gy < size; gy += WHEEL_PX) {
      for (let gx = 0; gx < size; gx += WHEEL_PX) {
        const ccx = gx + WHEEL_PX / 2;
        const ccy = gy + WHEEL_PX / 2;
        const dx = ccx - cx;
        const dy = ccy - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < innerR || dist > outerR) continue;
        let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (deg < 0) deg += 360;
        const band = Math.round(deg / (360 / WHEEL_HUE_STEPS));
        const qHue = (band * (360 / WHEEL_HUE_STEPS)) % 360;
        const sat = dist > (innerR + outerR) / 2 ? 90 : 65;
        cells.push({ x: gx, y: gy, fill: hslToHex(qHue, sat, 55) });
      }
    }
    return cells;
  }, [cx, cy, radius, size]);

  const CURSOR_CELLS = 3;
  const cursorEdge = WHEEL_PX * CURSOR_CELLS;
  const hueRad = (hue * Math.PI) / 180;
  const midR = radius - (WHEEL_PX * WHEEL_RING_CELLS) / 2;
  const rawCurX = cx + Math.cos(hueRad) * midR;
  const rawCurY = cy + Math.sin(hueRad) * midR;
  const curX = Math.floor(rawCurX / WHEEL_PX) * WHEEL_PX - cursorEdge / 2 + WHEEL_PX / 2;
  const curY = Math.floor(rawCurY / WHEEL_PX) * WHEEL_PX - cursorEdge / 2 + WHEEL_PX / 2;

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="slider"
      aria-label="Hue"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hue)}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onChange((hue - 5 + 360) % 360);
        if (e.key === "ArrowRight") onChange((hue + 5) % 360);
      }}
      shapeRendering="crispEdges"
      className="block mx-auto max-w-full cursor-crosshair touch-none"
    >
      {pixels.map((p, i) => (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={WHEEL_PX}
          height={WHEEL_PX}
          fill={p.fill}
          stroke="#000000"
          strokeWidth={0.25}
        />
      ))}
      <rect
        x={curX}
        y={curY}
        width={cursorEdge}
        height={cursorEdge}
        fill="#ffffff"
        stroke="#000000"
        strokeWidth={2}
      />
    </svg>
  );
}
