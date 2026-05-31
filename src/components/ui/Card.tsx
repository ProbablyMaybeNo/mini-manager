import type { ReactNode } from "react";
import { clsx } from "clsx";

export type CardAccent =
  | "cyan"
  | "green"
  | "amber"
  | "yellow"
  | "red"
  | "purple"
  | "neutral";

/** Heading level for the title element. Defaults to `h2`; sub-cards
 *  nested inside a larger section should pass `h3`. The card-header
 *  visual treatment is identical at every level — only the semantic
 *  outline shifts. */
export type CardTitleAs = "h2" | "h3";

const ACCENT_BG: Record<CardAccent, string> = {
  cyan: "bg-[var(--color-cyan)]",
  green: "bg-[var(--color-green)]",
  amber: "bg-[var(--color-amber)]",
  yellow: "bg-[var(--color-yellow)]",
  red: "bg-[var(--color-red)]",
  purple: "bg-[var(--color-purple-pastel)]",
  neutral: "bg-[var(--color-fg-muted)]",
};

export interface CardProps {
  title?: string;
  /** Heading level for the title. Defaults to `h2`. */
  titleAs?: CardTitleAs;
  headerActions?: ReactNode;
  accentColor?: CardAccent;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  /** Aria label for the section element. Defaults to title when present. */
  ariaLabel?: string;
}

/** Card — bordered surface with header bar + body. Replaces ad-hoc
 *  `frame p-N space-y-N` widget combos. Header is optional — omit `title`
 *  to render a headerless card (still bordered, body padding only).
 *
 *  The title renders as a real heading (`<h2>` by default, `<h3>` if
 *  nested) so screen-reader heading navigation can find every section
 *  on the page. Previously a `<span>`, which left `/sign-in`,
 *  `/sign-up`, etc. with zero headings in the document outline.
 *  UX-V3-005 — auditor round 3. */
export function Card({
  title,
  titleAs = "h2",
  headerActions,
  accentColor,
  className,
  bodyClassName,
  children,
  ariaLabel,
}: CardProps) {
  const hasHeader = Boolean(title || headerActions);
  const TitleTag = titleAs;
  return (
    <section
      className={clsx("card", className)}
      aria-label={ariaLabel ?? title}
    >
      {hasHeader ? (
        <header className="card-header">
          <span className="card-header-title">
            {accentColor ? (
              <span
                aria-hidden
                className={clsx("card-header-accent", ACCENT_BG[accentColor])}
              />
            ) : null}
            {title ? (
              <TitleTag className="card-header-heading truncate">
                {title}
              </TitleTag>
            ) : null}
          </span>
          {headerActions ? (
            <span className="inline-flex items-center gap-2">
              {headerActions}
            </span>
          ) : null}
        </header>
      ) : null}
      <div className={clsx("card-body", bodyClassName)}>{children}</div>
    </section>
  );
}
