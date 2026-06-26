"use client";

import { type ReactNode } from "react";
import { CloseButton } from "@/components/kit";

/**
 * The desktop master-detail right column (DOP-002). Mirrors SlideOutPanel's
 * visual language — black bg, cyan border, breadcrumb + title header, scrollable
 * body, footer slot — but is a persistent in-flow panel, NOT a modal: no
 * `fixed`, no scrim, no focus trap. It's reachable via normal Tab order; only
 * the close button needs an accessible name (a11y plan §4). Rendered inside
 * DashboardView's two-pane flex row, so the table stays visible alongside it
 * (no dimming).
 *
 * `<section aria-label="Project inspector">` keeps the dashboard's `<h1>` as the
 * page heading; the panel title is an `<h2>` inside the body (ProjectWorkspaceBody).
 */
export function InspectorPane({
  title,
  breadcrumb,
  onClose,
  children,
  footer,
}: {
  title: string;
  breadcrumb?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      aria-label="Project inspector"
      // Wider inspector (RF-5): ~840px, 880 at 2xl, but capped at 60vw so the
      // left projects table keeps a usable width on common desktops (~1280px →
      // pane 768px, table ~512px with its own horizontal scroll) and never
      // forces the table off-screen.
      className="flex h-full w-[840px] max-w-[60vw] shrink-0 flex-col border-l border-cyan/40 bg-bg shadow-[-18px_0_50px_-18px_rgba(0,0,0,0.9)] 2xl:w-[880px]"
    >
      <header className="flex items-start justify-between border-b border-cyan/40 px-4 py-3">
        <div>
          {breadcrumb && (
            <div className="label-osd tracking-[0.2em] text-fg">{breadcrumb}</div>
          )}
          <h2 className="label-osd-h2 text-cyan">{title}</h2>
        </div>
        <CloseButton
          onClick={onClose}
          aria-label="Close project inspector"
          className="h-11 w-11"
        />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer && (
        <footer className="border-t border-cyan/40 bg-bg px-4 py-3">{footer}</footer>
      )}
    </section>
  );
}
