import { clsx } from "clsx";

export type ProgressTone =
  | "auto"
  | "ok"
  | "info"
  | "warning"
  | "wishlist"
  | "danger"
  | "purple"
  /** @deprecated P11.10 — use `purple`. Mapped to the same pastel-purple
   *  fill for back-compat through the Phase 11 sweep. */
  | "magenta"
  | "neutral";

const TONE_FILL: Record<Exclude<ProgressTone, "auto">, string> = {
  ok:       "bg-[var(--status-ok)]",
  info:     "bg-[var(--status-info)]",
  warning:  "bg-[var(--status-warning)]",
  wishlist: "bg-[var(--status-wishlist)]",
  danger:   "bg-[var(--status-danger)]",
  purple:   "bg-[var(--status-purple)]",
  magenta:  "bg-[var(--status-purple)]",
  neutral:  "bg-[var(--color-fg-muted)]",
};

/**
 * Solid horizontal progress bar — the terminal-UI "loading bar" idiom.
 * Tone defaults to "auto": neutral when empty, cyan in early progress,
 * amber mid-build, neon green when complete. Pass an explicit tone to
 * lock the colour (e.g. tone="wishlist" for yellow on shopping
 * progress, tone="info" for read-only stats like CPU%).
 *
 * The `width` prop is the legacy ASCII-cell width count from the
 * earlier bracket-bar version — kept so call-sites don't change. It's
 * now translated to a pixel min-width so the bar still feels the same
 * size in dense rows.
 */
export function ProgressBar({
  percent,
  width = 20,
  tone = "auto",
  className,
  stretch = false,
  height = 8,
}: {
  percent: number;
  /** Cells of the original ASCII bar — mapped to ~6px per cell so the
   *  visual footprint matches the old bracket version. Ignored when
   *  `stretch` is true. */
  width?: number;
  tone?: ProgressTone;
  className?: string;
  /** P12.8 — full-width mode. When true the bar takes 100% of its
   *  parent container's inline-size instead of a fixed pixel width.
   *  Used by the project detail header strip. */
  stretch?: boolean;
  /** P12.8 — taller bar variant for the project detail header
   *  (default 8px stays cell-row friendly; 14px sells the "page-
   *  level progress" feel). */
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  // Phase-12 (P12.6) tone thresholds Ross locked:
  //   neutral when empty (0%)
  //   danger / pastel-red when behind         (< 25%)
  //   warning / pastel-yellow when mid-build  (25–74%)
  //   ok / neon-green when ahead              (>= 75%)
  // Older thresholds were 0/50/100 → cyan-info/amber/green. The
  // updated set matches the projects-dashboard "behind / mid / ahead"
  // glance Ross's brief calls out.
  const resolvedTone: Exclude<ProgressTone, "auto"> =
    tone !== "auto"
      ? tone
      : clamped === 0
        ? "neutral"
        : clamped >= 75
          ? "ok"
          : clamped >= 25
            ? "warning"
            : "danger";

  const fillClass = TONE_FILL[resolvedTone];
  const trackBg = "bg-[var(--color-bg-panel)]";
  const trackBorder = "border border-[var(--color-border)]";

  // ~6px per cell preserves the visual footprint vs the old bracket bar.
  const minPx = Math.max(40, width * 6);

  return (
    <span
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${clamped} percent complete`}
      className={clsx(
        // UX-V5-012/014: bumped from h-1.5 (6px) to h-2 (8px) so the
        // track + fill read as a real bar at 0%, not a hairline scratch.
        "relative rounded-sm overflow-hidden",
        stretch ? "block w-full" : "inline-block align-middle",
        trackBg,
        trackBorder,
        className,
      )}
      style={
        stretch
          ? { height: `${height}px` }
          : { width: `${minPx}px`, height: `${height}px` }
      }
    >
      <span
        aria-hidden
        className={clsx(
          "absolute inset-y-0 left-0 transition-[width] duration-300 ease-out",
          fillClass,
        )}
        style={{
          width: `${clamped}%`,
          boxShadow:
            clamped > 0
              ? `0 0 6px color-mix(in srgb, var(--status-${resolvedTone === "neutral" ? "info" : resolvedTone}) 35%, transparent)`
              : undefined,
        }}
      />
    </span>
  );
}
