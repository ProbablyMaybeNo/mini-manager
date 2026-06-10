import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Panel } from "@/components/ui/Panel";

export interface AuthShellProps {
  /** Visible PixelSplitter page title (the `.title-display` pixel font),
   *  rendered in cyan with the phosphor halo — the single <h1> for the page. */
  title: string;
  /** Tiny mono breadcrumb above the title — the `SYS ▸ ACCESS` idiom. */
  breadcrumb: string;
  /** Tiny technical caption notched onto the panel's top border. */
  techLabel?: string;
  /** One-line mono blurb under the title, inside the panel. */
  blurb?: ReactNode;
  /** The form (or result content). */
  children: ReactNode;
  /** Optional footer row under the panel (sign-up / back-to-sign-in links). */
  footer?: ReactNode;
}

/**
 * AuthShell — the single centered nested-border terminal Panel for every
 * auth surface (sign-in / sign-up / forgot / reset / finish-account /
 * verify-recovery), REBUILD_SPEC §10. One uniform language: the CRT logo
 * lockup with a tracked-out `SYS ▸ …` breadcrumb, a PixelSplitter pixel
 * title in cyan, and the form inside a `Panel` carrying the nested inner
 * ring + corner ticks + a tiny tech label on the border.
 *
 * Keeps the page's real <h1> visible (PixelSplitter) so heading navigation
 * resolves and the title reads as a lit OSD headline, not flat text.
 */
export function AuthShell({
  title,
  breadcrumb,
  techLabel,
  blurb,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="min-h-screen flex items-start md:items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
        {/* UX-1209 — cap the hero on mobile so the form stays above the
            fold. Full width returns at md+. */}
        <div className="flex flex-col items-center gap-2 pt-2 md:pt-0">
          <div className="w-full max-w-[140px] md:max-w-[220px]">
            <Logo decorative />
          </div>
          <p
            className="font-mono text-2xs uppercase tracking-[0.25em] text-[var(--color-cyan)]"
            aria-hidden
          >
            {breadcrumb}
          </p>
        </div>

        <Panel
          as="section"
          nested
          ticks
          label={techLabel}
          variant="cyan"
          aria-label={title}
          className="px-5 py-6 md:px-6 md:py-7 space-y-5"
        >
          <h1 className="title-display text-2xl md:text-3xl text-[var(--color-cyan)]">
            {title}
          </h1>
          {blurb ? (
            <p className="font-mono text-sm text-[var(--color-fg-muted)] leading-snug">
              {blurb}
            </p>
          ) : null}
          {children}
        </Panel>

        {footer ? (
          <div className="text-center text-xs font-mono text-[var(--color-fg-muted)]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A cyan-phosphor inline link tuned for the auth footer rows. */
export function AuthLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-[var(--color-cyan)] underline-offset-2 hover:underline focus-visible:underline"
    >
      {children}
    </Link>
  );
}
