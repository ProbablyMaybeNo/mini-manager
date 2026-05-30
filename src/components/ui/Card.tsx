import type { ReactNode } from "react";
import { clsx } from "clsx";

export type CardAccent = "cyan" | "green" | "amber" | "red" | "neutral";

const ACCENT_BG: Record<CardAccent, string> = {
  cyan: "bg-[var(--color-cyan)]",
  green: "bg-[var(--color-green)]",
  amber: "bg-[var(--color-amber)]",
  red: "bg-[var(--color-red)]",
  neutral: "bg-[var(--color-fg-muted)]",
};

export interface CardProps {
  title?: string;
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
 *  to render a headerless card (still bordered, body padding only). */
export function Card({
  title,
  headerActions,
  accentColor,
  className,
  bodyClassName,
  children,
  ariaLabel,
}: CardProps) {
  const hasHeader = Boolean(title || headerActions);
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
            {title ? <span className="truncate">{title}</span> : null}
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
