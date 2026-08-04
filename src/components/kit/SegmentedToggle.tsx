"use client";

import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Segmented control (LIST/GRID, Paint/Model, sign-in/sign-up). Controlled. */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex overflow-hidden rounded-[6px] border border-border bg-surface-2 p-0.5",
        disabled && "opacity-40",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              // flex-1 + min-w-0 so a full-width toggle splits into equal halves
              // instead of letting the longer label push the shorter one out of
              // the container (MUX-017). No effect on inline-width toggles.
              //
              // min-h-[39px] (R3-2): the chips measured 26px at 375px — the
              // smallest interactive family in the app, well under the 39px
              // every ordinary button gets (`+ NEW PROJECT`, `Import`,
              // `Sign out`) and under the 44-49px the nav/sheet controls get.
              // They clear WCAG 2.5.8's 24x24 either way; the problem was that
              // the app disagreed with itself about how big a tap target is.
              // The height is a floor, not a fix, so a caller can still make a
              // chip taller. `inline-flex` + centring is what keeps the label
              // in the middle now that the box is taller than its line box.
              "inline-flex min-h-[39px] min-w-0 flex-1 items-center justify-center rounded-[5px] px-3 py-1 font-button text-button uppercase tracking-[0.15em] transition-colors duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan",
              active
                ? "bg-cyan text-bg"
                : "text-fg-dim hover:bg-fg/5 hover:text-fg",
              disabled && "cursor-not-allowed",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
