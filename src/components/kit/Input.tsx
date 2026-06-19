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
          className="font-osd text-[12px] uppercase tracking-[0.18em] text-fg-dim"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex items-center gap-2 border bg-bg px-2 py-1.5 transition-[border-color,box-shadow] duration-150",
          error
            ? "border-red focus-within:shadow-[0_0_0_3px_rgba(255,66,66,0.12)]"
            : "border-cyan/50 focus-within:border-cyan focus-within:shadow-[0_0_0_3px_rgba(0,210,255,0.12)]",
        )}
      >
        {leading}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(
            "w-full bg-transparent font-mono text-sm text-fg placeholder:text-fg-faint focus:outline-none",
            className,
          )}
          {...props}
        />
        {trailing}
      </div>
      {error && <span className="font-mono text-[12px] text-red">{error}</span>}
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

/** Hex input with a live swatch preview as the leading slot. */
export function HexField({ value, ...props }: FieldProps) {
  const hex = typeof value === "string" ? value : "";
  return (
    <Input
      value={value}
      placeholder="#000000"
      leading={
        <span
          className="h-4 w-4 border border-fg/20"
          style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "transparent" }}
        />
      }
      {...props}
    />
  );
}
