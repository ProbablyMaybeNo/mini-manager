"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { CloseButton } from "@/components/kit";
import { cn } from "@/lib/cn";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/**
 * The mobile inspector surface (capstone MOP-001/DOP-001): a true bottom sheet.
 *
 * Detents (Apple HIG sheets / Material 3):
 *   - peek  `50dvh` — title, status, action bar visible,
 *   - full  `92dvh` — leaves a sliver of dashboard above (never full-screen).
 * Closed = translated fully down + pointer-events-none.
 *
 * Interaction:
 *   - grab handle (top-center, aria-hidden) + visible labeled close (D.2: never
 *     gesture-only),
 *   - vertical pointer-drag on the header/handle snaps between detents by an
 *     80px threshold or a velocity flick; dragging down past peek dismisses,
 *   - iOS back-swipe guard (B.3 Critical): a drag that starts within 40px of the
 *     left edge is ignored so it can't fight Safari's edge-swipe,
 *   - scrim tap: at full → peek, at peek → close,
 *   - `dvh` heights so a focused textarea + soft keyboard never overlap the
 *     sheet, body `touch-action: pan-y`, handle `touch-action: none`.
 *
 * Modal: `role=dialog aria-modal aria-label={title}`, shared focus trap. History
 * is owned by the caller (ProjectPanelStack pushes `mmInspector` on open); the
 * sheet just calls `onClose`, which the caller turns into a clean history.back.
 *
 * Same prop surface as SlideOutPanel so the stack can swap shells freely.
 */
type Detent = "peek" | "full";

const IOS_EDGE_GUARD_PX = 40;
const SNAP_THRESHOLD_PX = 80;
const FLICK_VELOCITY = 0.5; // px/ms

export function ProjectBottomSheet({
  open,
  onClose,
  title,
  breadcrumb,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  breadcrumb?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [detent, setDetent] = useState<Detent>("peek");
  // Live drag offset in px (0 = at the current detent; positive = dragged down).
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Pointer bookkeeping for velocity + guard, kept in a ref so move/up read it
  // without re-rendering.
  const drag = useRef<{ startY: number; startT: number; lastY: number; lastT: number } | null>(
    null,
  );

  useFocusTrap(panelRef, open, onClose);

  // Each fresh open resets to the peek detent.
  useEffect(() => {
    if (open) {
      setDetent("peek");
      setDragY(0);
    }
  }, [open]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      // iOS back-swipe guard: ignore drags that begin at the very left edge so
      // Safari's interactive-back gesture stays free (B.3 Critical).
      if (e.clientX < IOS_EDGE_GUARD_PX) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const t = e.timeStamp;
      drag.current = { startY: e.clientY, startT: t, lastY: e.clientY, lastT: t };
      setDragging(true);
    },
    [],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    // Only downward drag moves the sheet from `full`→`peek`→dismiss; an upward
    // drag from peek promotes toward full (negative offset, clamped).
    const raw = e.clientY - d.startY;
    setDragY(raw);
  }, []);

  const endDrag = useCallback(
    (e: ReactPointerEvent) => {
      const d = drag.current;
      drag.current = null;
      setDragging(false);
      if (!d) return;
      const dy = e.clientY - d.startY;
      const dt = Math.max(1, e.timeStamp - d.startT);
      const velocity = (e.clientY - d.lastY) / Math.max(1, e.timeStamp - d.lastT) || dy / dt;
      const flick = Math.abs(velocity) > FLICK_VELOCITY;
      const goingDown = dy > 0;

      setDragY(0);
      if (detent === "full") {
        // From full: a strong down drag/flick drops to peek; bigger drop closes.
        if (goingDown && (dy > SNAP_THRESHOLD_PX || flick)) {
          if (dy > window.innerHeight * 0.5) onClose();
          else setDetent("peek");
        }
      } else {
        // From peek: up drag/flick promotes to full; down drag/flick dismisses.
        if (!goingDown && (Math.abs(dy) > SNAP_THRESHOLD_PX || flick)) {
          setDetent("full");
        } else if (goingDown && (dy > SNAP_THRESHOLD_PX || flick)) {
          onClose();
        }
      }
    },
    [detent, onClose],
  );

  const onScrimClick = useCallback(() => {
    // Scrim tap: at full step down to peek; at peek dismiss (D.2 — tap-out).
    if (detent === "full") setDetent("peek");
    else onClose();
  }, [detent, onClose]);

  if (!open) return null;

  // Translate: while dragging, follow the finger (clamp upward pull so the sheet
  // can't be dragged above its full height). At rest, transform is 0 and the
  // detent height does the work.
  const clampedDragY = dragging ? Math.max(dragY, -40) : 0;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onScrimClick} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ transform: `translateY(${clampedDragY}px)` }}
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col border-t border-cyan bg-bg shadow-[0_-18px_50px_-18px_rgba(0,0,0,0.9),0_0_36px_rgba(0,210,255,0.14)] outline-none",
          detent === "full" ? "h-[92dvh]" : "h-[50dvh]",
          // Snap transitions ride motion-safe (reduced-motion users get instant
          // snaps via the global reset); disabled mid-drag so it tracks 1:1.
          !dragging && "motion-safe:transition-[transform,height] motion-safe:duration-200",
        )}
      >
        {/* Drag affordance + header. touch-action:none keeps the browser from
            scrolling/refreshing while the painter drags the sheet. */}
        <div
          className="shrink-0 touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* Grab handle — decorative; the labeled close is the real control. */}
          <div className="flex justify-center pt-2 pb-1">
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-cyan/50" />
          </div>
          <header className="flex items-start justify-between border-b border-cyan/40 px-4 py-2">
            <div className="min-w-0">
              {breadcrumb && (
                <div className="label-osd tracking-[0.2em] text-fg">{breadcrumb}</div>
              )}
              <h2 className="truncate label-osd-h2 text-cyan">{title}</h2>
            </div>
            <CloseButton
              onClick={onClose}
              aria-label="Close project inspector"
              className="h-11 w-11"
            />
          </header>
        </div>

        {/* Body scrolls; pan-y so vertical scroll works but horizontal gestures
            (iOS back) aren't hijacked. */}
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-4 py-4">{children}</div>

        {footer && (
          <footer className="shrink-0 border-t border-cyan/40 bg-bg px-4 py-3">{footer}</footer>
        )}
      </div>
    </div>
  );
}
