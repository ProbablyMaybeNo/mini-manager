import { cn } from "@/lib/cn";
import type { Hex } from "@/lib/types";

/** A single colour tile. */
export function Swatch({
  hex,
  size = "md",
  className,
  title,
}: {
  hex: Hex;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
}) {
  const dim = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-10 w-10" : "h-6 w-6";
  return (
    <span
      className={cn("inline-block border border-fg/20", dim, className)}
      style={{ backgroundColor: hex }}
      title={title ?? hex}
      aria-label={title ?? hex}
    />
  );
}

/**
 * Inline strip of small colour squares (the recurring "recipe" cell). When empty, renders
 * an "attach" affordance that fires onAttach.
 */
export function SwatchStrip({
  swatches,
  onAttach,
  ariaLabel,
  className,
}: {
  swatches: Hex[];
  onAttach?: () => void;
  /** Accessible label for the interactive strip. Lets a caller describe the
   *  action (e.g. "Edit <recipe>") instead of wrapping the strip in its own
   *  button — nesting a <button> inside a <button> is invalid HTML. */
  ariaLabel?: string;
  className?: string;
}) {
  if (swatches.length === 0) {
    return (
      <button
        type="button"
        onClick={onAttach}
        aria-label={ariaLabel}
        className={cn(
          // min-h-6 keeps the hit area ≥24px (WCAG 2.2 §2.5.8) without
          // enlarging the dense table cell (UX-008).
          "inline-flex min-h-6 items-center border border-dashed border-purple px-2 py-0.5 font-osd text-[9px] uppercase tracking-[0.15em] text-purple hover:border-purple hover:text-purple",
          className,
        )}
      >
        + attach
      </button>
    );
  }
  const strip = (
    <span className="inline-flex gap-0.5">
      {swatches.map((hex, i) => (
        <Swatch key={`${hex}-${i}`} hex={hex} size="sm" />
      ))}
    </span>
  );
  // When an onAttach handler is supplied, the populated strip stays
  // interactive so the painter can change the attached recipe.
  if (onAttach) {
    return (
      <button
        type="button"
        onClick={onAttach}
        aria-label={ariaLabel ?? "Change attached recipe"}
        className={cn(
          // min-h-6 lifts the 16px swatch strip's hit area to ≥24px
          // (WCAG 2.2 §2.5.8) without resizing the swatches (UX-008).
          "inline-flex min-h-6 items-center rounded-none hover:opacity-80",
          className,
        )}
      >
        {strip}
      </button>
    );
  }
  return <span className={cn("inline-flex gap-0.5", className)}>{strip}</span>;
}
