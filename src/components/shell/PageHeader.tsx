import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Standard page header: big cyan pixel title + one-line tagline, with optional actions. */
export function PageHeader({
  title,
  tagline,
  actions,
  className,
  taglineClassName,
}: {
  title: string;
  tagline?: string;
  actions?: ReactNode;
  className?: string;
  taglineClassName?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {/* HEX.CODE page title (4:4): Flexi IBM VGA True, uppercase, with a
            short cyan underline bar beneath it. Flexi is a bitmap VGA face —
            kept at a moderate size so it reads crisp, not arcade-huge. */}
        <h1 className="font-title text-[clamp(2.25rem,5.25vw,3.375rem)] font-extrabold uppercase leading-none tracking-[0.1em] text-fg-bright">
          {title}
        </h1>
        <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-cyan" />
        {tagline && (
          <p className={cn("mt-3 max-w-2xl font-mono text-body text-fg-dim", taglineClassName)}>{tagline}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
