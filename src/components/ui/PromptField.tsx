import type { InputHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

interface PromptFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  /** Field label rendered as a mono small-caps caption above the input. */
  label: ReactNode;
  /** Slot for validation / status content rendered below the input
   *  (e.g. the sign-up "available" pill). */
  trailing?: ReactNode;
  className?: string;
}

/** PromptField — the terminal command-prompt input idiom as a reusable
 *  field. A cyan ▸ caret sits inside a phosphor-tinted frame that lights
 *  to cyan on focus, so every auth input reads as a CLI command line
 *  rather than a generic SaaS box (DESIGN_LANGUAGE §5 / §10).
 *
 *  The whole control is a <label> wrapping the caption, the framed input,
 *  and any trailing status — so clicking the caption focuses the field and
 *  the accessible name is the label text. Behaviour is a thin pass-through:
 *  every native input attribute (name, type, autoComplete, required, etc.)
 *  forwards straight to the <input>. */
export function PromptField({
  label,
  trailing,
  className,
  ...inputProps
}: PromptFieldProps) {
  return (
    <label className={clsx("block space-y-2", className)}>
      <span className="block text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
        {label}
      </span>
      {/* Border uses --color-border-input (#666666, 3.34:1 on #0a0a0a) so
          the field boundary clears WCAG 2.2 §1.4.11 non-text contrast —
          the same token the R7-005 globals rule lifts .frame inputs to. */}
      <span
        className={clsx(
          "flex items-center gap-2 px-3 py-2 rounded-sm border tap-target",
          "bg-transparent border-[var(--color-border-input)]",
          "focus-within:border-[var(--color-cyan)] transition-colors motion-reduce:transition-none",
        )}
      >
        <span
          aria-hidden
          className="font-mono text-sm text-[var(--color-cyan)] select-none"
        >
          ▸
        </span>
        <input
          {...inputProps}
          className="flex-1 min-w-0 bg-transparent font-mono text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none border-0 p-0"
        />
      </span>
      {trailing}
    </label>
  );
}
