"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
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
  const lastFocused = useRef<HTMLElement | null>(null);
  // MM-24 — keep `onClose` out of the focus-trap effect deps via a ref.
  // Callers pass a fresh inline `onClose` on every render; if the effect
  // depended on it, each parent re-render (e.g. typing in an input INSIDE
  // the panel) tore down + re-ran this effect, which re-focused the panel
  // and dropped focus from the field after every keystroke. The effect now
  // runs only when `open` flips.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      lastFocused.current?.focus();
    };
  }, [open]);

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
              <div className="font-osd text-[12px] uppercase tracking-[0.2em] text-fg-faint">
                {breadcrumb}
              </div>
            )}
            <h2 className="font-osd text-sm uppercase tracking-[0.18em] text-cyan">
              {title}
            </h2>
          </div>
          <CloseButton onClick={onClose} aria-label="Close panel" />
        </header>
        <div className="h-[calc(100%-7rem)] overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <footer className="absolute bottom-0 w-full border-t border-cyan/40 bg-bg px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
