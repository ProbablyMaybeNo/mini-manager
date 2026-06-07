import type { ComponentType, ReactNode } from "react";
import { clsx } from "clsx";
import {
  Info,
  TriangleAlert,
  CircleCheck,
  CircleX,
  type LucideProps,
} from "lucide-react";

/** Semantic card surface — gold-standard §07, shared with <Panel>.
 *  default / info / warning / success / error / disabled. Colours the
 *  card border + edge glow in-hue and tints the header icon + title. */
export type CardVariant =
  | "default"
  | "info"
  | "warning"
  | "success"
  | "error"
  | "disabled";

const VARIANT_CLASS: Record<CardVariant, string | false> = {
  default: false,
  info: "panel-info",
  warning: "panel-warning",
  success: "panel-success",
  error: "panel-error",
  disabled: "panel-disabled",
};

const VARIANT_ICON: Record<CardVariant, ComponentType<LucideProps> | null> = {
  default: null,
  info: Info,
  warning: TriangleAlert,
  success: CircleCheck,
  error: CircleX,
  disabled: null,
};

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
  /** Semantic surface (gold-standard §07): default / info / warning /
   *  success / error / disabled. Colours the card border + edge glow
   *  in-hue and tints the header icon + title to match the spec image. */
  variant?: CardVariant;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  /** Aria label for the section element. Defaults to title when present. */
  ariaLabel?: string;
  /** Phase-0 terminal treatment: draw the inner nested-border ring (the
   *  box-in-box CRT bezel) over the card. Off by default — reserve it for
   *  headline / hero panels so the detail stays special. */
  nested?: boolean;
  /** Draw L-shaped corner ticks/brackets at the panel corners (the
   *  diegetic registration-mark detail). Off by default. */
  ticks?: boolean;
  /** Optional tiny technical caption slotted onto the top border (e.g.
   *  `SYS · OK`, a coordinate tag). Rendered aria-hidden — it's chrome
   *  flavour, not content. */
  techLabel?: string;
  /** Override the default `truncate` on the header heading. Pass e.g.
   *  `"whitespace-normal leading-tight"` to let a long title wrap to two
   *  lines instead of ellipsizing — used by the KPI strip at narrow
   *  widths (UX-008) where "AVG COMPLETION" clipped to "AVG COMPLET…". */
  titleClassName?: string;
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
  variant = "default",
  className,
  bodyClassName,
  children,
  ariaLabel,
  nested = false,
  ticks = false,
  techLabel,
  titleClassName,
}: CardProps) {
  const hasHeader = Boolean(title || headerActions);
  const TitleTag = titleAs;
  const VariantIcon = VARIANT_ICON[variant];
  return (
    <section
      className={clsx(
        "card",
        VARIANT_CLASS[variant],
        nested && "card-nested",
        ticks && "panel-ticks",
        className,
      )}
      aria-label={ariaLabel ?? title}
    >
      {techLabel ? (
        <span className="panel-label" aria-hidden>
          {techLabel}
        </span>
      ) : null}
      {hasHeader ? (
        <header
          className={clsx(
            "card-header",
            variant !== "default" && "card-header-variant",
          )}
        >
          <span className="card-header-title">
            {VariantIcon ? (
              <span className="card-header-variant-icon" aria-hidden>
                <VariantIcon size={16} strokeWidth={2} />
              </span>
            ) : null}
            {accentColor ? (
              <span
                aria-hidden
                className={clsx("card-header-accent", ACCENT_BG[accentColor])}
              />
            ) : null}
            {title ? (
              <TitleTag
                className={clsx(
                  "card-header-heading",
                  // Default to single-line truncation; callers can opt into
                  // wrapping (KPI strip, UX-008) via titleClassName.
                  titleClassName ?? "truncate",
                )}
              >
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
