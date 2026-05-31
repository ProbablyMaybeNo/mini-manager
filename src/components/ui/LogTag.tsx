import { clsx } from "clsx";

export type LogTagVariant = "info" | "okay" | "warn" | "err" | "debg";

/** Label text rendered inside the brackets for each variant. */
export const LOG_TAG_LABEL: Record<LogTagVariant, string> = {
  info: "INFO",
  okay: "OKAY",
  warn: "WARN",
  err:  "ERR",
  debg: "DEBG",
};

/** CSS colour class for each variant — all drawn from status tokens. */
export const LOG_TAG_COLOR: Record<LogTagVariant, string> = {
  info: "text-[var(--status-info)]",
  okay: "text-[var(--status-ok)]",
  warn: "text-[var(--status-warning)]",
  err:  "text-[var(--status-danger)]",
  debg: "text-[var(--status-purple)]",
};

export interface LogTagProps {
  variant: LogTagVariant;
  className?: string;
}

/**
 * LogTag — `[INFO]` / `[OKAY]` / `[WARN]` / `[ERR]` / `[DEBG]` tag.
 *
 * Inline mono chip, bracket-wrapped, coloured to semantic status tokens.
 * Use inline before a log line, error message, or toast prefix.
 * Inherits the parent's font-size — no forced size so it reads naturally
 * in both `text-xs` table rows and `text-sm` prose blocks.
 */
export function LogTag({ variant, className }: LogTagProps) {
  return (
    <span
      className={clsx(
        "inline-block font-mono font-normal tracking-wider",
        "shrink-0 select-none whitespace-nowrap",
        LOG_TAG_COLOR[variant],
        className,
      )}
      aria-label={LOG_TAG_LABEL[variant]}
    >
      [{LOG_TAG_LABEL[variant]}]
    </span>
  );
}
