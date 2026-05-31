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
  /* NB-4 spacing: bumped horizontal padding (px-4) and gap (gap-2) so the
     icon and label don't crowd, and added min-height to meet the 32px
     desktop tap-target floor. Tracking widened to 0.08em to match other
     mono chrome chips. */
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={clsx(
        "inline-flex items-center gap-2 px-4 py-1.5 min-h-[32px] font-mono text-xs uppercase tracking-[0.08em]",
        "transition-colors",
        active
          ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]",
      )}
    >
      {children}
    </button>
  );
}
