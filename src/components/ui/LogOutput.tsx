import { clsx } from "clsx";
import { LogTag, type LogTagVariant } from "./LogTag";

/** One log line — a timestamp, a level tag, and a message. */
export interface LogLine {
  /** Pre-formatted timestamp (e.g. "14:00:01"). Rendered verbatim. */
  time: string;
  /** Level → the bracketed colour tag (info/okay/warn/err/debug). */
  level: LogTagVariant;
  /** The white message text. */
  message: string;
}

export interface LogOutputProps {
  lines: ReadonlyArray<LogLine>;
  /** Optional caption slotted onto the panel's top border (e.g. "SYSTEM"). */
  label?: string;
  /** Cap the visible height + scroll older lines (px). Omit for full height. */
  maxHeight?: number;
  className?: string;
  /** Accessible name for the log region. Defaults to "Log output". */
  ariaLabel?: string;
}

/**
 * LogOutput — the gold-standard §10 log panel: a bordered terminal frame
 * holding rows of `timestamp · [LEVEL] · message`. The level tag is the
 * bracketed colour chip from <LogTag> (INFO cyan · OKAY green · WARN
 * yellow · DEBUG cyan-white · ERR red); the timestamp is dim mono and the
 * message bright white, matching the spec image exactly.
 *
 * Pure CSS, SSR-safe. Rendered as an aria-live="polite" log region so
 * appended lines are announced to assistive tech; the rows themselves are
 * a monospace grid so the timestamps + tags stay column-aligned.
 */
export function LogOutput({
  lines,
  label,
  maxHeight,
  className,
  ariaLabel = "Log output",
}: LogOutputProps) {
  return (
    <div
      className={clsx("panel log-output", label && "relative", className)}
      role="log"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      {label ? (
        <span className="panel-label" aria-hidden>
          {label}
        </span>
      ) : null}
      <div
        className="log-output-scroll"
        style={maxHeight ? { maxHeight: `${maxHeight}px` } : undefined}
      >
        {lines.map((line, i) => (
          <div className="log-line" key={i}>
            <span className="log-line-time">{line.time}</span>
            <LogTag variant={line.level} className="log-line-tag" />
            <span className="log-line-msg">{line.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
