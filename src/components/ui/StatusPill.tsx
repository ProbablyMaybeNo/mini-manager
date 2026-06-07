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

const DOT_CLASS: Record<StatusPillKind, string> = {
  ok: "pill-dot-ok",
  warning: "pill-dot-warning",
  wishlist: "pill-dot-wishlist",
  danger: "pill-dot-danger",
  info: "pill-dot-info",
  neutral: "pill-dot-neutral",
  purple: "pill-dot-purple",
  magenta: "pill-dot-magenta",
};

export interface StatusPillProps {
  status: StatusPillKind;
  children: ReactNode;
  className?: string;
  title?: string;
  /** Visual tone — outline pill (default) or the solid colour-bar. */
  tone?: StatusPillTone;
  /** Optional leading status dot (gold-standard §05 ONLINE/OFFLINE/BUSY).
   *  The dot carries its OWN colour, independent of the pill's border/text
   *  hue — e.g. a neutral white pill flagging a green "online" state. Pass
   *  `true` to colour the dot the same as the pill, or a kind to override
   *  (e.g. `<StatusPill status="neutral" dot="ok">ONLINE</StatusPill>`).
   *  Only valid on the outline tone; ignored on `tone="bar"`. */
  dot?: boolean | StatusPillKind;
}

/** StatusPill — bordered, mono, all-caps. Drives status indicators
 *  across project rows, paint types, wishlist items, recipe attachments.
 *
 *  Pass `tone="bar"` for the signature solid colour-bar-with-black-text
 *  treatment (the mission-table status idiom). Pass `dot` for the §05
 *  leading status disc (ONLINE / OFFLINE / BUSY). */
export function StatusPill({
  status,
  children,
  className,
  title,
  tone = "outline",
  dot = false,
}: StatusPillProps) {
  const isBar = tone === "bar";
  const dotKind: StatusPillKind | null = isBar
    ? null
    : dot === true
      ? status
      : dot === false
        ? null
        : dot;
  return (
    <span
      className={clsx(
        isBar ? "status-bar" : "pill",
        isBar ? BAR_CLASS[status] : KIND_CLASS[status],
        className,
      )}
      title={title}
    >
      {dotKind ? (
        <span className={clsx("pill-dot", DOT_CLASS[dotKind])} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}
