"use client";

import { clsx } from "clsx";
import { List, LayoutGrid } from "lucide-react";
import type { LibraryViewMode } from "@/lib/hooks/useLibraryViewMode";

export function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: LibraryViewMode;
  onChange: (next: LibraryViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Library view mode"
      className="inline-flex items-stretch border border-[var(--color-border-strong)] rounded-sm overflow-hidden"
    >
      <ToggleButton
        active={mode === "list"}
        onClick={() => onChange("list")}
        ariaLabel="List view"
      >
        <List size={14} strokeWidth={1.75} aria-hidden />
        <span>LIST</span>
      </ToggleButton>
      <span aria-hidden className="w-px bg-[var(--color-border-strong)]" />
      <ToggleButton
        active={mode === "grid"}
        onClick={() => onChange("grid")}
        ariaLabel="Grid view"
      >
        <LayoutGrid size={14} strokeWidth={1.75} aria-hidden />
        <span>GRID</span>
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  /* P12.20 spacing pass: bumped horizontal padding (px-5), gap (gap-2.5),
     and min-height (36px) so the toggle reads as a terminal-button bank
     instead of compact icon row. Tracking stays at 0.08em (matches other
     mono chrome chips). Active state keeps cyan-filled + dark text from
     the locked btn-primary discipline; hover gets a brighter cyan
     accent so the button feels responsive. */
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={clsx(
        "inline-flex items-center gap-2.5 px-5 py-2 min-h-[36px] font-mono text-xs uppercase tracking-[0.08em]",
        "transition-colors",
        active
          ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]",
      )}
    >
      {children}
    </button>
  );
}
