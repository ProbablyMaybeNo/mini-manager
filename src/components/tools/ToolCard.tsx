import Link from "next/link";
import type { Route } from "next";
import { clsx } from "clsx";

export type ToolTone = "cyan" | "yellow" | "green" | "purple" | "red";

interface Props {
  href: Route;
  glyph: string;
  title: string;
  blurb: string;
  /** Per-tool palette tone (P11.8) — drives the glyph colour, the
   *  hover-border, and the trailing `→` arrow. Each tool gets one
   *  colour from the locked 5-color palette so the index reads as
   *  a colour-coded launcher rather than a uniform grid. */
  tone?: ToolTone;
  /** Tiny technical caption slotted onto the panel's top border (the
   *  diegetic port/coordinate tag from the terminal language). */
  techLabel?: string;
}

/* Tailwind JIT needs each `group-hover:…` class spelled out literally
 * for the extractor to pick it up — string concatenation in TS isn't
 * scanned. Keep explicit per-tone maps to dodge that. */
const TONE_GLYPH_HOVER: Record<ToolTone, string> = {
  cyan:   "group-hover:text-[var(--color-cyan)]",
  yellow: "group-hover:text-[var(--color-yellow)]",
  green:  "group-hover:text-[var(--color-green)]",
  purple: "group-hover:text-[var(--color-purple-pastel)]",
  red:    "group-hover:text-[var(--color-red)]",
};

const TONE_HOVER_BORDER: Record<ToolTone, string> = {
  cyan:   "hover:border-[var(--color-cyan)] focus-visible:border-[var(--color-cyan)]",
  yellow: "hover:border-[var(--color-yellow)] focus-visible:border-[var(--color-yellow)]",
  green:  "hover:border-[var(--color-green)] focus-visible:border-[var(--color-green)]",
  purple: "hover:border-[var(--color-purple-pastel)] focus-visible:border-[var(--color-purple-pastel)]",
  red:    "hover:border-[var(--color-red)] focus-visible:border-[var(--color-red)]",
};

/* The per-tone color-bar chip (solid fill, black glyph) that anchors each
 * tile — the §7.2 "color bars with black text" signature element. */
const TONE_BAR: Record<ToolTone, string> = {
  cyan:   "bg-[var(--color-cyan)]",
  yellow: "bg-[var(--color-yellow)]",
  green:  "bg-[var(--color-green)]",
  purple: "bg-[var(--color-purple-pastel)]",
  red:    "bg-[var(--color-red)]",
};

/**
 * One card on the Tools landing page, re-skinned to the terminal language
 * (batch/redesign-tools): a near-black `.panel` tile carrying corner ticks
 * + a top-border tech label. The glyph rides a solid per-tone color-bar
 * chip with black text (the §7.2 signature), and the title/arrow fade to
 * the tool's tone on hover so the index reads as a colour-coded launcher.
 */
export function ToolCard({
  href,
  glyph,
  title,
  blurb,
  tone = "cyan",
  techLabel,
}: Props) {
  const toneGlyphHover = TONE_GLYPH_HOVER[tone];
  const toneHoverBorder = TONE_HOVER_BORDER[tone];
  const toneBar = TONE_BAR[tone];
  return (
    <Link
      href={href}
      className={clsx(
        // UX-010 — the folder/file tiles "lift" on hover/focus: a small
        // upward translate + a phosphor drop-shadow in the tile's tone so
        // the 2x2 grid reads as physical boxes that pop forward when
        // targeted (moodboard group-27 "boxes that open"). Motion-safe;
        // reduced-motion users keep the border + colour cues only.
        "group block relative panel panel-ticks p-4",
        "transition-[transform,box-shadow,border-color] motion-reduce:transition-none",
        "motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5",
        "hover:shadow-[0_6px_18px_-6px_color-mix(in_srgb,var(--color-cyan)_45%,transparent)]",
        "focus-visible:shadow-[0_6px_18px_-6px_color-mix(in_srgb,var(--color-cyan)_45%,transparent)]",
        toneHoverBorder,
      )}
    >
      {techLabel ? (
        <span className="panel-label" aria-hidden>
          {techLabel}
        </span>
      ) : null}
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={clsx(
            "grid place-items-center w-10 h-10 shrink-0 font-mono text-xl text-black",
            toneBar,
          )}
        >
          {glyph}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className={clsx(
              "font-mono text-base text-[var(--color-fg)] transition-colors",
              toneGlyphHover,
            )}
          >
            {title}
          </h2>
          <p className="mt-1 text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
            {blurb}
          </p>
        </div>
        <span
          aria-hidden
          className={clsx(
            "font-mono text-xs text-[var(--color-fg-subtle)] transition-colors",
            toneGlyphHover,
          )}
        >
          →
        </span>
      </div>
    </Link>
  );
}
