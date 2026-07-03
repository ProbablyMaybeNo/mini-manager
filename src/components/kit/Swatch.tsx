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
          // ≥44px tap target on touch widths (MUX-003); stays compact (≥24px,
          // WCAG 2.2 §2.5.8) in the dense desktop table cell.
          "inline-flex min-h-[44px] items-center rounded-[6px] border border-dashed border-purple/60 px-2 py-0.5 font-button text-button uppercase tracking-[0.15em] text-purple transition-colors duration-150 hover:border-purple hover:bg-purple/10 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple md:min-h-6",
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
          // ≥44px tap target on touch widths (MUX-003); ≥24px (WCAG 2.2 §2.5.8)
          // on desktop without resizing the 16px swatches.
          "inline-flex min-h-[44px] items-center rounded-[4px] transition-opacity duration-150 hover:opacity-80 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan md:min-h-6",
          className,
        )}
      >
        {strip}
      </button>
    );
  }
  return <span className={cn("inline-flex gap-0.5", className)}>{strip}</span>;
}
