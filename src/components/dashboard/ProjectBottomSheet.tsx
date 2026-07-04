"use client";

import { useRef, type ReactNode } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/**
 * The mobile inspector surface (RF-10): a full-screen takeover.
 *
 * Replaces the keystone's detent/drag bottom sheet — Ross's explicit
 * preference. Opening a project covers the viewport; a back chevron in the
 * top-left corner closes it. The close wiring is unchanged: it calls `onClose`,
 * which ProjectPanelStack turns into a clean `history.back()` so the Phase-4
 * history model still pops one sub-project tier before closing, and OS Back
 * works the same way.
 *
 * Modal semantics: `role=dialog aria-modal aria-label={title}`, shared focus
 * trap (D.2 — the labelled back button is the real, non-gesture-only control).
 * `dvh` height so a focused textarea + soft keyboard never overlaps the action
 * bar. The action bar (RF-1) lives inside the scrollable body (sticky bottom).
 *
 * Kept named `ProjectBottomSheet` for import stability; `ProjectMobileSurface`
 * is the canonical alias the InspectorShell uses.
 */
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
  useFocusTrap(panelRef, open, onClose);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-bg outline-none"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-cyan/40 px-2 py-2">
        {/* Top-left back chevron — the full-screen view's only close control
            (RF-10). Routes through onClose → ProjectPanelStack history so it
            pops one sub-project tier before closing, matching OS Back. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-cyan-lite hover:bg-cyan/10 focus:outline-none focus-visible:bg-cyan/15"
        >
          <span aria-hidden className="text-h2">‹</span>
        </button>
        <div className="min-w-0">
          {breadcrumb && (
            <div className="label-osd tracking-[0.2em] text-fg">{breadcrumb}</div>
          )}
          <h2 className="truncate label-osd-h2 text-cyan-lite">{title}</h2>
        </div>
      </header>

      {/* Body scrolls; the sticky RF-1 action bar pins to its bottom. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

      {footer && (
        <footer className="shrink-0 border-t border-cyan/40 bg-bg px-4 py-3">{footer}</footer>
      )}
    </div>
  );
}

/**
 * Canonical name for "the mobile inspector surface" used by InspectorShell.
 * Stable across the RF-10 swap from detent sheet → full-screen takeover.
 */
export const ProjectMobileSurface = ProjectBottomSheet;
