import type { ReactNode } from "react";
import { clsx } from "clsx";

export type StatusPillKind = "ok" | "warning" | "danger" | "info" | "neutral";

const KIND_CLASS: Record<StatusPillKind, string> = {
  ok: "pill-ok",
  warning: "pill-warning",
  danger: "pill-danger",
  info: "pill-info",
  neutral: "pill-neutral",
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
