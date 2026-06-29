import type { InputHTMLAttributes, ReactNode } from "react";
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
  const inputId = id ?? props.name;
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
        className={cn(
          "flex items-center gap-2 rounded-[6px] border bg-surface-2 px-2.5 py-2 transition-[border-color,box-shadow] duration-150",
          error
            ? "border-red focus-within:shadow-[0_0_0_3px_rgba(255,75,75,0.15)]"
            : "border-border focus-within:border-cyan focus-within:shadow-[0_0_0_3px_rgba(0,245,255,0.15)]",
        )}
      >
        {leading}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(
            // min-h-6 floors the field at 24px (WCAG 2.2 §2.5.8) — the 23.5px
            // Body line-box otherwise drops the bare input to 23px (UX-006).
            "min-h-6 w-full bg-transparent font-body text-body text-fg placeholder:text-[#757575] focus:outline-none",
            className,
          )}
          {...props}
        />
        {trailing}
      </div>
      {error && <span className="font-body text-body text-red">{error}</span>}
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
