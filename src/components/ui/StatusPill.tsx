import type { ReactNode } from "react";
import { clsx } from "clsx";

export type StatusPillKind =
  | "ok"
  | "warning"
  | "wishlist"
  | "danger"
  | "info"
  | "neutral"
  | "purple"
  /** @deprecated P11.10 — use `purple`. Kept for back-compat through the
   *  Phase 11 sweep, mapped to the same pastel-purple class. */
  | "magenta";

/** Visual tone of the chip.
 *  - `outline` (default): the classic bordered-on-black pill — coloured
 *    border + coloured text, transparent fill.
 *  - `bar`: the signature "colour bar with black text" element
 *    (DESIGN_LANGUAGE §7.2) — a SOLID phosphor fill with crisp black
 *    text, used in the mission table so a row's status reads as a solid
 *    colour-coded block at a glance. */
export type StatusPillTone = "outline" | "bar";

const KIND_CLASS: Record<StatusPillKind, string> = {
  ok: "pill-ok",
  warning: "pill-warning",
  wishlist: "pill-wishlist",
  danger: "pill-danger",
  info: "pill-info",
  neutral: "pill-neutral",
  purple: "pill-purple",
  magenta: "pill-purple",
};

const BAR_CLASS: Record<StatusPillKind, string> = {
  ok: "status-bar-ok",
  warning: "status-bar-warning",
  wishlist: "status-bar-wishlist",
  danger: "status-bar-danger",
  info: "status-bar-info",
  neutral: "status-bar-neutral",
  purple: "status-bar-purple",
  magenta: "status-bar-magenta",
};

export interface StatusPillProps {
  status: StatusPillKind;
  children: ReactNode;
  className?: string;
  title?: string;
  /** Visual tone — outline pill (default) or the solid colour-bar. */
  tone?: StatusPillTone;
}

/** StatusPill — bordered, mono, all-caps. Drives status indicators
 *  across project rows, paint types, wishlist items, recipe attachments.
 *
 *  Pass `tone="bar"` for the signature solid colour-bar-with-black-text
 *  treatment (the mission-table status idiom). */
export function StatusPill({
  status,
  children,
  className,
  title,
  tone = "outline",
}: StatusPillProps) {
  const isBar = tone === "bar";
  return (
    <span
      className={clsx(
        isBar ? "status-bar" : "pill",
        isBar ? BAR_CLASS[status] : KIND_CLASS[status],
        className,
      )}
      title={title}
    >
      {children}
    </span>
  );
}
