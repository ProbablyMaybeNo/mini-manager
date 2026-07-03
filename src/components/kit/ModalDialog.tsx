"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CloseButton } from "./CloseButton";

/**
 * Centered, focus-trapped modal overlay — the dialog counterpart to
 * {@link SlideOutPanel}. Same phosphor language (black bg, cyan border,
 * lit edge), ESC closes, backdrop click closes, focus returns to the
 * trigger on unmount. Presentational: open state + onClose live in the
 * caller.
 */
export function ModalDialog({
  open,
  onClose,
  title,
  breadcrumb,
  width = "max-w-sm",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  breadcrumb?: string;
  width?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  // MM-24 — keep `onClose` out of the focus-trap effect deps (see
  // SlideOutPanel): a fresh inline `onClose` each render would otherwise
  // re-run this effect and steal focus from a field inside the dialog after
  // every keystroke.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 motion-safe:animate-scrim-in"
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
          "relative w-full border border-cyan bg-bg shadow-[0_0_36px_rgba(0,210,255,0.14),0_24px_60px_-24px_rgba(0,0,0,0.9)] outline-none motion-safe:animate-sheet-in",
          width,
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
          {/* 44px close target for a high-frequency modal dismiss (MUX-008) —
              the ✕ glyph stays its resting size, only the padded box grows. */}
          <CloseButton
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-11 min-w-11"
          />
        </header>
        <div className="px-4 py-4">{children}</div>
        {footer && (
          // Footer buttons lift to a 44px min-height on touch widths (MUX-008),
          // staying compact on desktop — lifts every dialog, not just one.
          <footer className="border-t border-cyan/40 px-4 py-3 [&_button]:min-h-[44px] md:[&_button]:min-h-0">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
