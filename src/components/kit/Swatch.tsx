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
  className,
}: {
  swatches: Hex[];
  onAttach?: () => void;
  className?: string;
}) {
  if (swatches.length === 0) {
    return (
      <button
        type="button"
        onClick={onAttach}
        className={cn(
          "border border-dashed border-fg-faint px-2 py-0.5 font-osd text-[9px] uppercase tracking-[0.15em] text-fg-faint hover:border-cyan hover:text-cyan",
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
        aria-label="Change attached recipe"
        className={cn("inline-flex rounded-none hover:opacity-80", className)}
      >
        {strip}
      </button>
    );
  }
  return <span className={cn("inline-flex gap-0.5", className)}>{strip}</span>;
}
