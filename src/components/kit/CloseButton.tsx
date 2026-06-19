import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Canonical dismiss / remove affordance. Before this, the `✕` was hand-built in
 * ~8 places with two different glyphs (`✕` U+2715 vs `×` U+00D7) and clashing
 * hover colours. One primitive, one glyph (`✕`), two semantic tones:
 *   - `dismiss`     (default) → close a surface (dialog / panel / preview): hover cyan
 *   - `destructive`           → remove an item (slot / layer / row / swatch): hover red
 *
 * Resting state is the dim foreground; the global `:focus-visible` rule supplies
 * the 2px cyan ring (we never set `focus:outline-none`). An `aria-label` is
 * required — the glyph alone is not an accessible name.
 */
export interface CloseButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  tone?: "dismiss" | "destructive";
}

export function CloseButton({
  className,
  tone = "dismiss",
  type = "button",
  ...props
}: CloseButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        // ≥24px hit area (WCAG 2.2 §2.5.8) without enlarging the glyph — the
        // ✕ stays its resting size, the tap target is the padded box.
        "inline-flex min-h-6 min-w-6 items-center justify-center font-osd leading-none text-fg-dim transition-colors",
        tone === "destructive" ? "hover:text-red" : "hover:text-cyan",
        className,
      )}
      {...props}
    >
      ✕
    </button>
  );
}
