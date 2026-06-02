"use client";

import { clsx } from "clsx";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  /** Group label for assistive tech (applied to the tablist). */
  ariaLabel: string;
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Stretch each segment to fill the track (mobile pane switchers). */
  fill?: boolean;
  className?: string;
}

/**
 * Shared segmented control / tab switcher (UX-1306).
 *
 * Before this primitive each surface (ATTACH RECIPE Pick/Create, recipe
 * editor Slots/Notes) hand-rolled its own toggle with only a ~10%
 * colour-mix tint on the active segment — invisible against the panel,
 * so the selected view was indistinguishable visually. This renders the
 * selected segment with a SOLID cyan fill + black text (the P13.1 fill
 * discipline) so the active view reads instantly.
 *
 * Semantics: a `role="tablist"` of `role="tab"` buttons with
 * `aria-selected` on the active one. `aria-pressed` is also set so the
 * toggle state is exposed even to AT that treats these as buttons.
 */
export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  fill = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx("segmented", fill && "flex w-full", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={clsx(
              "segment tap-target",
              fill && "flex-1",
              active && "segment-active",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
