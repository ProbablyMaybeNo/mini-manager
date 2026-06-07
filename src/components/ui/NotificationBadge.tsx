import { clsx } from "clsx";

export interface NotificationBadgeProps {
  /** The unread count. <= 0 renders nothing (no empty badge). */
  count: number;
  /** Clamp the displayed number (e.g. 99 → "99+"). Default 99. */
  max?: number;
  /** Accessible label. Defaults to "<n> unread". */
  ariaLabel?: string;
  className?: string;
}

/**
 * NotificationBadge — gold-standard §12 red count chip.
 *
 * A small red-outline box holding a red count, matching the image's
 * "NOTIFICATIONS [3]" affordance. Renders nothing when count <= 0 so an
 * empty badge never shows. The number is exposed to assistive tech via an
 * aria-label; the visible glyph is aria-hidden so SR users hear "3 unread"
 * not a bare "3".
 */
export function NotificationBadge({
  count,
  max = 99,
  ariaLabel,
  className,
}: NotificationBadgeProps) {
  if (count <= 0) return null;
  const shown = count > max ? `${max}+` : String(count);
  return (
    <span
      className={clsx("notif-badge", className)}
      role="status"
      aria-label={ariaLabel ?? `${count} unread`}
    >
      <span aria-hidden>{shown}</span>
    </span>
  );
}
