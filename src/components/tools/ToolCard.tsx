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

/**
 * One card on the Tools landing page. Per-tool palette tone (P11.8)
 * colour-codes the glyph + hover border so the index reads as a
 * launcher rather than a uniform grid. Glyph fades from muted →
 * full tone on hover/focus.
 */
export function ToolCard({ href, glyph, title, blurb, tone = "cyan" }: Props) {
  const toneGlyphHover = TONE_GLYPH_HOVER[tone];
  const toneHoverBorder = TONE_HOVER_BORDER[tone];
  return (
    <Link
      href={href}
      className={clsx(
        "group block frame p-4 transition-colors",
        toneHoverBorder,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={clsx(
            "font-mono text-2xl text-[var(--color-fg-muted)] transition-colors",
            toneGlyphHover,
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
