"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { X } from "lucide-react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface SlideOutPanelProps {
  open: boolean;
  /** Called on Esc, backdrop click, or the × button. */
  onClose: () => void;
  /** Accessible dialog name; rendered as the panel heading. */
  title: string;
  /** Tiny breadcrumb above the title — the `SYS > PAINT` idiom. */
  breadcrumb?: string;
  /** Desktop panel width in px (full-width sheet below md). Default 360. */
  width?: number;
  /** Docking edge on desktop. Default "right" (the app-wide pattern);
   *  "left" exists for the mobile nav sheet. */
  side?: "right" | "left";
  children: ReactNode;
  className?: string;
}

/**
 * SlideOutPanel — the single slide-out idiom (FIGMA-REBUILD foundation,
 * REBUILD_SPEC §0.3): SOLID BLACK background + CYAN border, docked to the
 * right edge on desktop, a full-width sheet on mobile. Used by the library
 * FILTER + PAINT INFO panels, the project inspector, and the mobile nav.
 *
 * Accessibility contract (REBUILD_SPEC §11):
 *  - role="dialog" aria-modal, named by the visible title
 *  - focus moves into the panel on open, is TRAPPED (Tab cycles), and
 *    returns to the opener on close
 *  - Esc closes; backdrop click closes
 *  - close button is a ≥44px target
 *  - slide animation is motion-safe only (reduced-motion gets placement)
 */
export function SlideOutPanel({
  open,
  onClose,
  title,
  breadcrumb,
  width = 360,
  side = "right",
  children,
  className,
}: SlideOutPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useRef(
    `slideout-${Math.random().toString(36).slice(2, 9)}`,
  ).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Move focus in on open; restore to the opener on close/unmount.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus();
    }
    // Scroll-lock the page behind the modal panel.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Focus trap — cycle Tab / Shift+Tab inside the panel.
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]" onKeyDown={onKeyDown}>
      {/* Backdrop — click to dismiss (the × + Esc are the accessible paths). */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ "--slideout-w": `${width}px` } as CSSProperties}
        className={clsx(
          "absolute inset-y-0 flex w-full flex-col overflow-y-auto",
          "md:w-[min(var(--slideout-w),90vw)]",
          // Solid black ground + cyan phosphor border on the docked edge
          // (REBUILD_SPEC §0.3 — one uniform panel language app-wide).
          "bg-[var(--color-bg)] text-[var(--color-fg)]",
          side === "right"
            ? "right-0 border-l border-[var(--color-cyan)] motion-safe:[animation:drawer-in_200ms_ease-out]"
            : "left-0 border-r border-[var(--color-cyan)] motion-safe:[animation:drawer-in-left_200ms_ease-out]",
          "glow-edge",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color-mix(in_srgb,var(--color-cyan)_45%,transparent)] px-4 py-3">
          <div className="min-w-0">
            {breadcrumb ? (
              <p
                className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--color-cyan)]"
                aria-hidden
              >
                {breadcrumb}
              </p>
            ) : null}
            <h2
              id={titleId}
              className="font-mono text-base font-semibold uppercase tracking-[0.06em] text-[var(--color-cyan)] glow-text-strong"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="tap-target -mr-1 inline-flex shrink-0 items-center justify-center text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-cyan)] motion-reduce:transition-none"
          >
            <X size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="flex-1 px-4 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
