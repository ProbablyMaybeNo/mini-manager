"use client";

/**
 * M4.2 / D6.2 — CollectionCanvas.
 *
 * A single <canvas> that replaces the ~7,144-node DOM button grid. Paints the
 * hue-sorted spectrum as filled rects, then draws a SPARSE overlay of dots
 * for owned (green) / wishlisted (yellow) cells using the token colours read
 * live from getComputedStyle — so the canvas always tracks the design-system
 * palette without any hardcoded hex.
 *
 * Resize: a ResizeObserver measures the container width and redraws whenever
 * the canvas changes size. The backing store is scaled by devicePixelRatio for
 * crisp pixels on HiDPI screens; CSS width is set to 100% and CSS height
 * matches layout.height.
 *
 * Pointer: click/tap maps the event offset to a cell via indexAtPoint and
 * calls onPickCell. The canvas itself is role="img" with a summary aria-label;
 * keyboard navigation lives in the parent's visible "Fill gaps" button.
 *
 * No raw hex in code — swatch fills come from cell.paint.hex (data, not a
 * token); dot fills come from var(--color-green) / var(--color-yellow) /
 * var(--color-bg) via getComputedStyle.
 */

import { useCallback, useEffect, useRef } from "react";
import type { CoverageCell } from "@/db/queries/paintCoverage";
import type { CoverageState } from "@/lib/paints/coverage";
import {
  CELL_MIN_PX,
  DOT_RING_PX,
  DOT_SIZE_PX,
  OVERLAY_SAMPLE_STRIDE,
  cellRectAt,
  computeCanvasLayout,
  indexAtPoint,
  showsOverlayDot,
} from "./heatSinkHelpers";

interface Props {
  /** Visible cells, hue-sorted — one pixel each. */
  cells: readonly CoverageCell[];
  /** aria-label summary for the canvas (non-interactive, role="img"). */
  summaryLabel: string;
  /** Effective coverage state for a paint id, reflecting optimistic overrides. */
  stateForPaint: (id: string, fallback: CoverageState) => CoverageState;
  /** Called when the user clicks/taps a cell. */
  onPickCell: (cell: CoverageCell) => void;
}

/** Read a CSS custom property value from the canvas element. */
function tokenColour(el: HTMLCanvasElement, token: string): string {
  return getComputedStyle(el).getPropertyValue(token).trim();
}

export function CollectionCanvas({
  cells,
  summaryLabel,
  stateForPaint,
  onPickCell,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Store width separately so the draw effect re-runs on resize.
  const widthRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = widthRef.current;
    if (width <= 0) return;

    const layout = computeCanvasLayout(cells.length, width, CELL_MIN_PX);
    const dpr = window.devicePixelRatio ?? 1;

    // Resize the backing store only when dimensions change to avoid flickering.
    const bsW = Math.round(layout.width * dpr);
    const bsH = Math.round(layout.height * dpr);
    if (canvas.width !== bsW || canvas.height !== bsH) {
      canvas.width = bsW;
      canvas.height = bsH;
    }
    // CSS size always matches layout.
    canvas.style.width = layout.width + "px";
    canvas.style.height = layout.height + "px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, layout.width, layout.height);

    // Read token colours once per draw (tracks theme changes).
    const colorGreen = tokenColour(canvas, "--color-green");
    const colorYellow = tokenColour(canvas, "--color-yellow");
    const colorBg = tokenColour(canvas, "--color-bg");

    // --- Pass 1: paint every cell as its hex colour. ---
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell) continue;
      const rect = cellRectAt(i, layout);
      ctx.fillStyle = cell.paint.hex;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }

    // --- Pass 2: sparse overlay dots (A2). ---
    // Walk cells in hue order, count marked ones, draw a dot on every
    // OVERLAY_SAMPLE_STRIDE-th marked cell.
    let markedIndex = 0;
    const dotRadius = DOT_SIZE_PX / 2;
    const ringWidth = DOT_RING_PX;

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell) continue;
      const effective = stateForPaint(cell.paint.id, cell.state);
      if (effective === "none") continue;

      if (showsOverlayDot(markedIndex, OVERLAY_SAMPLE_STRIDE)) {
        const rect = cellRectAt(i, layout);
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;

        // Ring (background colour so dot reads on any pixel).
        ctx.beginPath();
        ctx.arc(cx, cy, dotRadius + ringWidth, 0, Math.PI * 2);
        ctx.fillStyle = colorBg;
        ctx.fill();

        // Dot fill (owned → green, wanted → yellow).
        ctx.beginPath();
        ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = effective === "owned" ? colorGreen : colorYellow;
        ctx.fill();
      }
      markedIndex += 1;
    }
  }, [cells, stateForPaint]);

  // ResizeObserver: measure the container, update widthRef, redraw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement ?? canvas;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = entry.contentRect.width;
      if (w > 0) {
        widthRef.current = w;
        draw();
      }
    });
    ro.observe(container);
    // Initial measurement.
    const w = container.getBoundingClientRect().width;
    if (w > 0) {
      widthRef.current = w;
      draw();
    }
    return () => ro.disconnect();
  }, [draw]);

  // Redraw when cells or stateForPaint change (draw is already a dep
  // of the ResizeObserver effect via the callback ref — but we also
  // need an explicit redraw when data changes without a size change).
  useEffect(() => {
    draw();
  }, [draw]);

  // DPR change (e.g. drag between monitors).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(
      "(resolution: " + (window.devicePixelRatio ?? 1) + "dppx)",
    );
    const onChange = () => draw();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [draw]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      // Map from viewport px to CSS px within the canvas.
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;
      const layout = computeCanvasLayout(
        cells.length,
        widthRef.current,
        CELL_MIN_PX,
      );
      const index = indexAtPoint(cssX, cssY, layout, cells.length);
      if (index === null) return;
      const cell = cells[index];
      if (cell) onPickCell(cell);
    },
    [cells, onPickCell],
  );

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={summaryLabel}
      style={{ display: "block", width: "100%", cursor: "crosshair" }}
      onClick={handleClick}
    />
  );
}
