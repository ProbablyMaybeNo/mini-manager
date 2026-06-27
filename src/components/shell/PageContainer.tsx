import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * DOP-014 — the one content-width convention for the main app pages.
 *
 * The app reads as a dense terminal: panels, tables, the colour map and the
 * tools wheel all want the full canvas width, so the standard is *full-bleed*
 * (no max-width content cap) with a uniform `p-6` gutter and `gap-6` rhythm,
 * inside a full-height vertical scroll column. Codifying it here stops each
 * page from hand-rolling its own `flex h-full flex-col gap-6 p-6` and drifting.
 *
 * Pages with bespoke shells (the dashboard's master-detail pane + sticky
 * events ticker, the focus bench) keep their own layout but the same `p-6`
 * gutter, so the right-edge gutter stays uniform across the app.
 *
 * Scroll lives in the AppShell `<main>` (`overflow-y-auto flex-1`), so the
 * default container is just a full-height `p-6` column and lets the page
 * overflow up to that scroller — matching the dominant existing pattern. Pass
 * `scroll` for a self-contained scroll column (e.g. when the page owns a
 * sticky footer beneath the scroll region).
 */
export function PageContainer({
  children,
  className,
  scroll = false,
}: {
  children: ReactNode;
  className?: string;
  scroll?: boolean;
}) {
  return (
    <div
      className={cn(
        // A3 — between-groups rhythm bumped to 32px (was 24) for a clearly
        // roomier vertical cadence; 24px gutter stays uniform with the app.
        "flex h-full flex-col gap-8 p-6",
        scroll && "overflow-y-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
