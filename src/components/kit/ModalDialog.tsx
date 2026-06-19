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
          "relative w-full border border-cyan bg-bg shadow-[0_0_36px_rgba(0,210,255,0.14),0_24px_60px_-24px_rgba(0,0,0,0.9)] outline-none",
          width,
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
          <CloseButton onClick={onClose} aria-label="Close dialog" />
        </header>
        <div className="px-4 py-4">{children}</div>
        {footer && (
          <footer className="border-t border-cyan/40 px-4 py-3">{footer}</footer>
        )}
      </div>
    </div>
  );
}
