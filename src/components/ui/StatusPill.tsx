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

export interface StatusPillProps {
  status: StatusPillKind;
  children: ReactNode;
  className?: string;
  title?: string;
}

/** StatusPill — bordered, mono, all-caps. Drives status indicators
 *  across project rows, paint types, wishlist items, recipe attachments. */
export function StatusPill({
  status,
  children,
  className,
  title,
}: StatusPillProps) {
  return (
    <span className={clsx("pill", KIND_CLASS[status], className)} title={title}>
      {children}
    </span>
  );
}
