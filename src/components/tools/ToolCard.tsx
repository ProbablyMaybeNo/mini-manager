import Link from "next/link";
import type { Route } from "next";

interface Props {
  href: Route;
  glyph: string;
  title: string;
  blurb: string;
}

/**
 * One card on the Tools landing page. Phosphor-green active state on
 * hover; matches the terminal-block aesthetic established by RecipeCard
 * and the project rows.
 */
export function ToolCard({ href, glyph, title, blurb }: Props) {
  return (
    <Link
      href={href}
      className="group block frame p-4 transition-colors hover:border-[var(--color-accent)] focus-visible:border-[var(--color-accent)]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="font-mono text-2xl text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)] group-hover:glow-cyan"
        >
          {glyph}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-base text-[var(--color-fg)] group-hover:glow-cyan">
            {title}
          </h2>
          <p className="mt-1 text-xs font-sans text-[var(--color-fg-muted)]">
            {blurb}
          </p>
        </div>
        <span
          aria-hidden
          className="font-mono text-xs text-[var(--color-fg-subtle)] group-hover:text-[var(--color-accent)]"
        >
          →
        </span>
      </div>
    </Link>
  );
}
