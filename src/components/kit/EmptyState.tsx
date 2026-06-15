import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

/**
 * The one first-run / no-data block for the app. A faint glyph, a title,
 * a one-line hint, and an optional primary action — so an empty surface
 * reads as intentional rather than broken. Presentational; the caller
 * owns the action.
 */
export function EmptyState({
  glyph = "▦",
  title,
  hint,
  action,
  className,
}: {
  glyph?: ReactNode;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 py-14 text-center",
        className,
      )}
    >
      <span aria-hidden className="font-osd text-3xl text-fg-faint/40">
        {glyph}
      </span>
      <p className="font-osd text-sm uppercase tracking-[0.18em] text-fg-dim">
        {title}
      </p>
      {hint && (
        <p className="max-w-xs font-mono text-xs text-fg-faint">{hint}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  );
}
