import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerClassName?: string;
}

/** Terminal-styled text input with optional label, leading/trailing slots, inline error. */
export function Input({
  label,
  error,
  leading,
  trailing,
  containerClassName,
  className,
  id,
  ...props
}: FieldProps) {
  const reactId = useId();
  const inputId = id ?? props.name ?? reactId;
  // Stable id so the input's aria-describedby can point at its error text.
  const errorId = `${inputId}-error`;
  return (
    <div className={cn("flex flex-col gap-1", containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="label-osd text-fg"
        >
          {label}
        </label>
      )}
      <div
        // The vertical padding moved onto the <input> (see below) so the whole
        // 42px box is tappable. It used to live here, on a plain div with no
        // handler, so 43% of every field's height was dead: a click 4px inside
        // the visible border hit the wrapper and focused nothing (MUX4-005).
        className={cn(
          "flex items-center gap-2 rounded-[6px] border bg-surface-2 px-2.5 transition-[border-color,box-shadow] duration-150",
          error
            ? "border-red focus-within:shadow-[0_0_0_3px_rgba(255,75,75,0.15)]"
            : "border-border focus-within:border-cyan focus-within:shadow-[0_0_0_3px_rgba(0,245,255,0.15)]",
        )}
      >
        {leading}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            // min-h-6 floors the field at 24px (WCAG 2.2 §2.5.8) — the 23.5px
            // Body line-box otherwise drops the bare input to 23px (UX-006).
            // text-[16px] on mobile stops iOS Safari's focus zoom (F1); the
            // desktop scale (sm:text-body → 13px) is unchanged. The utility
            // class is needed because it outranks the element-level 16px floor.
            // py-2 lives here now, and min-h-11 makes the input itself the full
            // 44px target rather than a 24px strip inside a 42px box.
            // `roomy:` not `sm:` — gated on width alone, both the 44px height
            // and the 16px anti-zoom size reverted on every landscape phone,
            // silently undoing this fix one round after it shipped.
            "min-h-11 w-full bg-transparent py-2 font-body text-[16px] text-fg placeholder:text-fg-muted focus:outline-none roomy:min-h-6 roomy:text-body",
            className,
          )}
          {...props}
        />
        {trailing}
      </div>
      {/* Always-rendered live region so a screen reader announces the error
          the moment it appears; `empty:hidden` keeps it out of layout (no gap)
          while there's no message. */}
      <span
        id={errorId}
        aria-live="polite"
        className="font-body text-body text-red-text empty:hidden"
      >
        {error}
      </span>
    </div>
  );
}

/** Search field convenience wrapper. */
export function SearchField(props: FieldProps) {
  return (
    <Input
      type="search"
      placeholder="Search…"
      leading={<span className="font-osd text-xs text-fg-faint">▸</span>}
      {...props}
    />
  );
}

interface HexFieldProps extends FieldProps {
  /**
   * When provided, the leading colour square becomes a button that fires this
   * handler — the "click the swatch to open the colour picker" affordance.
   * Requires `swatchLabel` for the accessible name. Omit for a decorative
   * preview square (the default).
   */
  onSwatchClick?: () => void;
  /** Accessible label for the interactive swatch, e.g. "Pick substrate colour". */
  swatchLabel?: string;
}

/** Hex input with a live swatch preview as the leading slot. */
export function HexField({ value, onSwatchClick, swatchLabel, ...props }: HexFieldProps) {
  const hex = typeof value === "string" ? value : "";
  const bg = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "transparent";
  const preview = (
    <span
      className="block h-4 w-4 border border-fg/20"
      style={{ backgroundColor: bg }}
    />
  );
  return (
    <Input
      value={value}
      placeholder="#000000"
      leading={
        onSwatchClick ? (
          <button
            type="button"
            onClick={onSwatchClick}
            aria-label={swatchLabel}
            // ≥24px hit area (WCAG 2.2 §2.5.8) around the 16px square, with a
            // visible focus ring that matches the kit's cyan phosphor.
            className="-m-1 flex h-6 w-6 items-center justify-center rounded-none p-1 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
          >
            {preview}
          </button>
        ) : (
          preview
        )
      }
      {...props}
    />
  );
}
