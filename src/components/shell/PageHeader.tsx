import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Standard page header: big cyan pixel title + one-line tagline, with optional actions. */
export function PageHeader({
  title,
  tagline,
  actions,
  className,
}: {
  title: string;
  tagline?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <h1 className="font-display text-2xl leading-tight text-cyan text-glow-cyan sm:text-3xl">
          {title}
        </h1>
        {tagline && (
          <p className="mt-2 max-w-2xl font-mono text-xs text-fg-dim">{tagline}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
