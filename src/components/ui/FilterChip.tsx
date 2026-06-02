"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Shared filter chip (UX-1308). A bordered, ground-tinted toggle pill
 * that reads as a discrete tappable chip (Jakob's Law) rather than a run
 * of inline-text buttons, and floors to a 44px tap area on coarse
 * pointers via `tap-target`. The active chip takes the cyan accent and
 * exposes `aria-pressed`.
 */
export function FilterChip({ active, onClick, children, className }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx("chip tap-target", active && "chip-active", className)}
    >
      {children}
    </button>
  );
}
