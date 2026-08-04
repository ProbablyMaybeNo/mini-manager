import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Standard page header: big cyan pixel title + one-line tagline, with optional actions. */
export function PageHeader({
  title,
  tagline,
  actions,
  className,
  taglineClassName,
  as: Heading = "h1",
}: {
  title: string;
  tagline?: string;
  actions?: ReactNode;
  className?: string;
  taglineClassName?: string;
  /**
   * Heading level for the title. Defaults to `h1` — one page, one h1. Pass
   * `h2` when the header opens a SECTION of a page that already has its own
   * h1 (R3-3: `/user` stacks Settings + Account and was rendering two h1s,
   * giving screen-reader users two competing page titles). Purely semantic —
   * the visual size is the same either way.
   */
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {/* HEX.CODE page title (4:4): Nouveau IBM (Ross 2026-07-10, FINAL),
            uppercase, wide letter-spacing, with a short cyan underline bar
            beneath it. Nouveau IBM reads small, so the point size is pushed
            well above a normal display face. */}
        <Heading className="font-title text-[clamp(1.125rem,2.8vw,1.78rem)] font-extrabold uppercase leading-none tracking-[0.15em] text-fg-bright">
          {title}
        </Heading>
        <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-cyan" />
        {/* Taglines are hidden on any phone-sized viewport, landscape included
            (MUX2-009). Routes were each opting out with `hidden md:block`, and
            `md` is true at 812×375 — so rotating a phone brought back a
            four-line description that portrait had already judged not worth its
            height, on a screen with 375px to spend. `roomy:` gates on both axes;
            callers can still override via taglineClassName. */}
        {tagline && (
          <p
            className={cn(
              "mt-3 hidden max-w-2xl font-mono text-body text-fg-dim roomy:block",
              taglineClassName,
            )}
          >
            {tagline}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
