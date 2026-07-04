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
              "rounded-[5px] px-3 py-1 font-button text-button uppercase tracking-[0.15em] transition-colors duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan",
              active
                ? "bg-cyan text-white"
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
