"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CloseButton } from "./CloseButton";

/**
 * The one slide-out language for the whole app: detail / inspector / filter surfaces all use
 * this. Black bg + cyan border, right-anchored, focus-trapped, ESC closes, focus returns to
 * the trigger. Presentational — open state + onClose are owned by the caller.
 */
export function SlideOutPanel({
  open,
  onClose,
  title,
  breadcrumb,
  side = "right",
  width = "max-w-sm",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  breadcrumb?: string;
  side?: "right" | "left";
  width?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Shared modal focus trap (MM-24 ref pattern lives inside the hook now):
  // focus in on open, Tab cycle, Escape closes, focus restored on close.
  useFocusTrap(panelRef, open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "absolute top-0 h-full w-full border-cyan bg-bg shadow-[0_0_36px_rgba(0,210,255,0.14),-18px_0_50px_-18px_rgba(0,0,0,0.9)] outline-none",
          width,
          side === "right" ? "right-0 border-l" : "left-0 border-r",
        )}
      >
        <header className="flex items-start justify-between border-b border-cyan/40 px-4 py-3">
          <div>
            {breadcrumb && (
              <div className="label-osd tracking-[0.2em] text-fg">
                {breadcrumb}
              </div>
            )}
            <h2 className="label-osd-h2 text-cyan">
              {title}
            </h2>
          </div>
          {/* h-11 (44px) makes the top-right dismiss a thumb-friendly target
              (MUX-010); the ✕ glyph itself stays its resting size. */}
          <CloseButton
            onClick={onClose}
            aria-label="Close panel"
            className="h-11 w-11"
          />
        </header>
        <div className="h-[calc(100%-7rem)] overflow-y-auto px-4 py-4">{children}</div>
        {/* A panel is full-bleed on mobile, so the top-right ✕ sits out of thumb
            reach. Provide a bottom-anchored secondary dismiss (MUX-010): the
            caller's footer if given, else a default full-width Close button.
            Esc and an overlay tap also close (see onKey + the scrim onClick). */}
        <footer className="absolute bottom-0 w-full border-t border-cyan/40 bg-bg px-4 py-3">
          {footer ?? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-full items-center justify-center border border-cyan/40 font-button text-button uppercase tracking-[0.15em] text-fg-dim transition-colors hover:border-cyan hover:text-cyan focus:outline-none focus-visible:border-cyan focus-visible:text-cyan"
            >
              ✕ Close
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
