import { clsx } from "clsx";

export interface AccentCounterProps {
  value: string | number;
  /** Position offset from the surface's corner. Defaults to top-right. */
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  className?: string;
}

const POSITION_CLASS: Record<NonNullable<AccentCounterProps["position"]>, string> = {
  "top-right": "top-6 right-6",
  "top-left": "top-6 left-6",
  "bottom-right": "bottom-6 right-6",
  "bottom-left": "bottom-6 left-6",
};

/** AccentCounter — decorative giant faded-cyan numeral. Sits absolutely
 *  positioned in a parent corner (the parent must be `relative`).
 *  Hidden on mobile to preserve narrow viewport real estate.
 *  Pointer-events disabled, aria-hidden — pure decoration. */
export function AccentCounter({
  value,
  position = "top-right",
  className,
}: AccentCounterProps) {
  return (
    <span
      aria-hidden
      className={clsx(
        "pointer-events-none select-none absolute hidden md:block",
        "font-mono font-bold leading-none",
        "text-[96px] tracking-tighter",
        POSITION_CLASS[position],
        className,
      )}
      style={{
        color: "color-mix(in srgb, var(--color-cyan) 10%, transparent)",
      }}
    >
      {value}
    </span>
  );
}
