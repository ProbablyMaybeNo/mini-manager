import { clsx } from "clsx";

export type LogTagVariant = "info" | "okay" | "warn" | "err" | "debug";

/** Label text rendered inside the brackets for each variant — matches the
 *  gold-standard §10 set exactly: [INFO] [OKAY] [WARN] [DEBUG] [ERR]. */
export const LOG_TAG_LABEL: Record<LogTagVariant, string> = {
  info: "INFO",
  okay: "OKAY",
  warn: "WARN",
  err:  "ERR",
  debug: "DEBUG",
};

/** CSS colour class for each variant — all drawn from status tokens.
 *  Gold-standard §10: INFO cyan · OKAY green · WARN yellow · ERR red ·
 *  DEBUG white/cyan (the image's debug line is a quiet cyan-white, not
 *  the prior pastel-purple). */
export const LOG_TAG_COLOR: Record<LogTagVariant, string> = {
  info: "text-[var(--status-info)]",
  okay: "text-[var(--status-ok)]",
  warn: "text-[var(--status-warning)]",
  err:  "text-[var(--status-danger)]",
  debug: "text-[var(--color-cyan-bright)]",
};

export interface LogTagProps {
  variant: LogTagVariant;
  className?: string;
}

/**
 * LogTag — `[INFO]` / `[OKAY]` / `[WARN]` / `[ERR]` / `[DEBUG]` tag.
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
