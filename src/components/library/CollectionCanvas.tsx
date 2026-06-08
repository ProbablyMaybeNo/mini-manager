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
  OVERLAY_SAMPLE_STRIDE,
  cellRectAt,
  computeCanvasLayout,
  dotMetricsForCell,
  fitWithinLayout,
  indexAtPoint,
  showsOverlayDot,
} from "./heatSinkHelpers";
import type { CanvasLayout } from "./heatSinkHelpers";

interface Props {
  /** Visible cells, hue-sorted — one pixel each. */
  cells: readonly CoverageCell[];
  /** aria-label summary for the canvas (non-interactive, role="img"). */
  summaryLabel: string;
  /** Effective coverage state for a paint id, reflecting optimistic overrides. */
  stateForPaint: (id: string, fallback: CoverageState) => CoverageState;
  /** Called when the user clicks/taps a cell. */
  onPickCell: (cell: CoverageCell) => void;
  /**
   * UX-009 — called as the pointer moves over a cell (and with `null` when
   * it leaves the field). Drives the panel's live hover readout so the
   * spectrum reads as an interactive coverage map, not decoration. Optional:
   * omit it on surfaces that only want click-to-jump.
   */
  onHoverCell?: (cell: CoverageCell | null) => void;
  /**
   * LIB-COLORMAP-POLISH (1) — the minimum cell edge in CSS px. Defaults to
   * the compact `CELL_MIN_PX` (4px); the desktop panel passes a larger
   * floor so the pixels read clearly in the tall side column.
   */
  cellMinPx?: number;
  /**
   * LIB-COLORMAP-FIT (1) — when true, the canvas measures its container's
   * height and sizes the grid (via `fitWithinLayout`) so the WHOLE spectrum
   * is visible inside the panel with no vertical scroll: cells grow to fill
   * spare height, or shrink below the min edge when the catalog is too large
   * for the panel — always fitting both width and height. Off by default →
   * legacy width-only layout.
   */
  fillHeight?: boolean;
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
  onHoverCell,
  cellMinPx = CELL_MIN_PX,
  fillHeight = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Store width/height separately so the draw effect re-runs on resize.
  const widthRef = useRef<number>(0);
  const heightRef = useRef<number>(0);

  // Single source of truth for the layout so draw() and hit-testing agree.
  const resolveLayout = useCallback(
    (width: number, height: number): CanvasLayout =>
      fillHeight
        ? fitWithinLayout(cells.length, width, height, cellMinPx)
        : computeCanvasLayout(cells.length, width, cellMinPx),
    [cells.length, cellMinPx, fillHeight],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = widthRef.current;
    if (width <= 0) return;

    const layout = resolveLayout(width, heightRef.current);
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
    // LIB-COLORMAP-POLISH (3) — size the dot + its near-black ring to the
    // actual cell so markers grow with the bigger desktop pixels and stay
    // legible against a same-hue pixel underneath.
    const dotMetrics = dotMetricsForCell(layout.cellSize);
    const dotRadius = dotMetrics.size / 2;
    const ringWidth = dotMetrics.ring;

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell) continue;
      const effective = stateForPaint(cell.paint.id, cell.state);
      if (effective === "none") continue;

      if (showsOverlayDot(markedIndex, OVERLAY_SAMPLE_STRIDE)) {
        const rect = cellRectAt(i, layout);
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;

        // LIB-COLORMAP-POLISH (3) — solid black (--color-bg) border so the
        // dot reads against a same-hue pixel underneath. A filled bg disc
        // lays the outline, then a crisp stroke at the dot edge gives a
        // hard, even border that doesn't blur into the fill.
        ctx.beginPath();
        ctx.arc(cx, cy, dotRadius + ringWidth, 0, Math.PI * 2);
        ctx.fillStyle = colorBg;
        ctx.fill();

        // Dot fill (owned → green, wanted → yellow).
        ctx.beginPath();
        ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = effective === "owned" ? colorGreen : colorYellow;
        ctx.fill();

        // Crisp outline stroke at the ring's OUTER edge — sharpens the
        // black border against the pixel field without eating the coloured
        // fill, so the marker stays legible at every cell size.
        ctx.beginPath();
        ctx.arc(cx, cy, dotRadius + ringWidth, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = colorBg;
        ctx.stroke();
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
      const h = entry.contentRect.height;
      if (w > 0) {
        widthRef.current = w;
        // Height only matters for fill-height layouts; harmless to track.
        if (h > 0) heightRef.current = h;
        draw();
      }
    });
    ro.observe(container);
    // Initial measurement.
    const initialRect = container.getBoundingClientRect();
    if (initialRect.width > 0) {
      widthRef.current = initialRect.width;
      if (initialRect.height > 0) heightRef.current = initialRect.height;
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

  // Map a pointer event to the cell under it (or null off the field).
  const cellAtEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): CoverageCell | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      // Map from viewport px to CSS px within the canvas.
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;
      const layout = resolveLayout(widthRef.current, heightRef.current);
      const index = indexAtPoint(cssX, cssY, layout, cells.length);
      if (index === null) return null;
      return cells[index] ?? null;
    },
    [cells, resolveLayout],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = cellAtEvent(e);
      if (cell) onPickCell(cell);
    },
    [cellAtEvent, onPickCell],
  );

  // UX-009 — live hover readout. Skips emitting when the cell under the
  // pointer hasn't changed so we don't thrash the parent's state on every
  // mousemove pixel.
  const lastHoverId = useRef<string | null>(null);
  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onHoverCell) return;
      const cell = cellAtEvent(e);
      const id = cell?.paint.id ?? null;
      if (id === lastHoverId.current) return;
      lastHoverId.current = id;
      onHoverCell(cell);
    },
    [cellAtEvent, onHoverCell],
  );

  const handleLeave = useCallback(() => {
    if (!onHoverCell) return;
    if (lastHoverId.current === null) return;
    lastHoverId.current = null;
    onHoverCell(null);
  }, [onHoverCell]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={summaryLabel}
      style={{ display: "block", width: "100%", cursor: "crosshair" }}
      onClick={handleClick}
      onMouseMove={onHoverCell ? handleMove : undefined}
      onMouseLeave={onHoverCell ? handleLeave : undefined}
    />
  );
}
