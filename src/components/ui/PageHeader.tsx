import type { ReactNode } from "react";
import { clsx } from "clsx";

/** Page accent colours — REBUILD_SPEC §2: DASHBOARD green, LIBRARY purple,
 *  RECIPE red, TOOLS cyan, FOCUS cyan, COLLECTION yellow. */
export type PageAccent = "cyan" | "green" | "yellow" | "purple" | "red";

const ACCENT_VAR: Record<PageAccent, string> = {
  cyan: "var(--color-cyan)",
  green: "var(--color-green)",
  yellow: "var(--color-yellow)",
  purple: "var(--color-purple-pastel)",
  red: "var(--color-red)",
};

export interface PageHeaderProps {
  /** Page title — rendered in PixelSplitter (`.title-display`), uppercase,
   *  in the page accent colour with the phosphor halo. Keep it short
   *  (DASHBOARD / LIBRARY / FOCUS …). */
  title: string;
  /** Page accent colour (REBUILD_SPEC §2 table). */
  accent: PageAccent;
  /** One-line IBM Plex Mono tagline under the title. Unique per page. */
  tagline?: string;
  /** Right-aligned slot for page-level controls (view toggles, the
   *  Collection add-bar, …). Wraps under the title on narrow screens. */
  children?: ReactNode;
  className?: string;
}

/**
 * PageHeader — the shared page-top lockup (FIGMA-REBUILD foundation).
 *
 * PixelSplitter display title in the page's accent phosphor with the
 * `.title-display` contour + glow treatment (reduced-motion keeps the
 * static contour, drops the halo), and a 15px mono tagline below. An
 * optional `children` slot docks page controls to the right on desktop.
 *
 * Renders the page's single <h1>; section headers below it use UAV OSD
 * Mono (`--font-tactical`) via the global h2/section styles.
 */
export function PageHeader({
  title,
  accent,
  tagline,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={clsx(
        "flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1
          className="title-display text-2xl md:text-3xl"
          style={{ color: ACCENT_VAR[accent] }}
        >
          {title}
        </h1>
        {tagline ? (
          <p className="mt-1 font-mono text-sm text-[var(--color-fg)]">
            {tagline}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
        </div>
      ) : null}
    </header>
  );
}
