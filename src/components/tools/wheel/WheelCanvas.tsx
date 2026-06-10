"use client";

import { useCallback, useEffect, useRef } from "react";
import { hslToHex } from "@/lib/tools/wheel/harmonies";

const DEFAULT_SIZE = 360;
const PICKER_RADIUS = 9;

export interface WheelStop {
  id: string;
  hue: number;
  saturation: number;
  /** True for the primary swatch — the one the painter drags to drive
   *  the harmony. Derived swatches snap around it. */
  isPrimary?: boolean;
}

interface Props {
  /** Square canvas edge in CSS pixels. Capped via min() at the call site. */
  size?: number;
  /** L* applied to the wheel surface + every stop. Owned by the parent. */
  lightness: number;
  stops: ReadonlyArray<WheelStop>;
  activeId: string | null;
  onPrimaryChange: (next: { hue: number; saturation: number }) => void;
  onActiveChange: (id: string) => void;
}

/**
 * Canvas-rendered HSL wheel + draggable picker glyphs. The parent owns
 * harmony state; this component is a controlled view that emits the new
 * primary HSL coordinates when the painter drags. Derived stops are
 * rendered for context — only the primary is draggable.
 */
export function WheelCanvas({
  size = DEFAULT_SIZE,
  lightness,
  stops,
  activeId,
  onPrimaryChange,
  onActiveChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<string | null>(null);
  // Cache the rendered wheel keyed by (size, lightness). Re-drawing the
  // full image data on every drag pin event is the perf cliff to avoid.
  const wheelCacheRef = useRef<{
    key: string;
    image: ImageData;
  } | null>(null);

  const center = size / 2;
  const radius = center - 8;

  const drawWheel = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const cacheKey = `${size}-${lightness}`;
      if (wheelCacheRef.current?.key === cacheKey) {
        ctx.putImageData(wheelCacheRef.current.image, 0, 0);
        return;
      }
      const img = ctx.createImageData(size, size);
      const data = img.data;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - center;
          const dy = y - center;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const idx = (y * size + x) * 4;
          if (dist > radius) {
            data[idx + 3] = 0;
            continue;
          }
          let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
          if (angle < 0) angle += 360;
          const sat = Math.min(100, (dist / radius) * 100);
          const hex = hslToHex(angle, sat, lightness);
          data[idx] = parseInt(hex.slice(1, 3), 16);
          data[idx + 1] = parseInt(hex.slice(3, 5), 16);
          data[idx + 2] = parseInt(hex.slice(5, 7), 16);
          data[idx + 3] = 255;
        }
      }
      wheelCacheRef.current = { key: cacheKey, image: img };
      ctx.putImageData(img, 0, 0);
    },
    [size, center, radius, lightness],
  );

  const drawOverlay = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      // Border ring + tick at 0/90/180/270.
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();

      for (let i = 0; i < 4; i++) {
        const angle = i * 90 - 90;
        const rad = (angle * Math.PI) / 180;
        const inner = radius - 4;
        const outer = radius + 4;
        ctx.beginPath();
        ctx.moveTo(
          center + inner * Math.cos(rad),
          center + inner * Math.sin(rad),
        );
        ctx.lineTo(
          center + outer * Math.cos(rad),
          center + outer * Math.sin(rad),
        );
        ctx.strokeStyle = "rgba(81,253,128,0.45)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    },
    [center, radius],
  );

  const drawPickers = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      for (const stop of stops) {
        const rad = ((stop.hue - 90) * Math.PI) / 180;
        const dist = (stop.saturation / 100) * radius;
        const x = center + dist * Math.cos(rad);
        const y = center + dist * Math.sin(rad);
        const hex = hslToHex(stop.hue, stop.saturation, lightness);
        const isActive = activeId === stop.id;
        const isPrimary = stop.isPrimary === true;

        if (isActive) {
          ctx.beginPath();
          ctx.arc(x, y, PICKER_RADIUS + 5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,210,255,0.18)";
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(x, y, PICKER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = hex;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, PICKER_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = isActive
          ? "#7DF9FF"
          : isPrimary
            ? "#51FD80"
            : "rgba(255,255,255,0.85)";
        ctx.lineWidth = isActive ? 2 : 1.5;
        ctx.stroke();

        // Crosshair on the primary.
        if (isPrimary) {
          ctx.beginPath();
          ctx.moveTo(x - 3, y);
          ctx.lineTo(x + 3, y);
          ctx.moveTo(x, y - 3);
          ctx.lineTo(x, y + 3);
          ctx.strokeStyle = "rgba(10,10,10,0.85)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    },
    [stops, center, radius, lightness, activeId],
  );

  // Redraw on any state change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    drawWheel(ctx);
    drawOverlay(ctx);
    drawPickers(ctx);
  }, [drawWheel, drawOverlay, drawPickers, size]);

  // Drop the wheel cache when size/lightness changes (handled via key
  // mismatch inside drawWheel — no explicit reset required).

  const posToHs = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy), radius);
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;
      return { hue: angle, saturation: (dist / radius) * 100 };
    },
    [center, radius],
  );

  const hitTest = useCallback(
    (clientX: number, clientY: number): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;
      // Prefer the primary if multiple stops overlap so dragging always
      // moves the harmony.
      let bestId: string | null = null;
      let bestPrimary = false;
      for (const stop of stops) {
        const rad = ((stop.hue - 90) * Math.PI) / 180;
        const dist = (stop.saturation / 100) * radius;
        const sx = center + dist * Math.cos(rad);
        const sy = center + dist * Math.sin(rad);
        const d = Math.sqrt((x - sx) ** 2 + (y - sy) ** 2);
        if (d <= PICKER_RADIUS + 4) {
          const isPrimary = stop.isPrimary === true;
          if (bestId === null || (isPrimary && !bestPrimary)) {
            bestId = stop.id;
            bestPrimary = isPrimary;
          }
        }
      }
      return bestId;
    },
    [stops, center, radius],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) {
      // Pointer down on empty wheel space → move primary there.
      const next = posToHs(e.clientX, e.clientY);
      if (next) {
        onPrimaryChange(next);
        const primary = stops.find((s) => s.isPrimary === true);
        if (primary) {
          dragRef.current = primary.id;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }
      }
      return;
    }
    onActiveChange(hit);
    // Only the primary stop is draggable — derived stops follow the
    // harmony math.
    const target = stops.find((s) => s.id === hit);
    if (target?.isPrimary) {
      dragRef.current = hit;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const next = posToHs(e.clientX, e.clientY);
    if (next) onPrimaryChange(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="max-w-full cursor-crosshair touch-none select-none"
      role="img"
      aria-label="Colour wheel"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
