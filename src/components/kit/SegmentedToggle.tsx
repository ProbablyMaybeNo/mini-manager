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
  className,
  "aria-label": ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex border border-cyan/60", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1 font-osd text-[10px] uppercase tracking-[0.15em] transition-colors",
              active ? "bg-cyan/20 text-cyan glow-cyan" : "text-fg-dim hover:text-cyan",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
