"use client";

import { clsx } from "clsx";
import { List, LayoutGrid } from "lucide-react";
import type { LibraryViewMode } from "@/lib/hooks/useLibraryViewMode";

/**
 * Two-button view-mode toggle, terminal_ui INIT/SAVE/PAUSE/KILL style:
 * each button is a standalone bordered + colored chip with bold mono
 * caps text. Active = filled yellow with dark text. Inactive =
 * yellow-outlined with yellow text. Sits separately with a gap (not
 * joined as a segmented group). Matches the smaller-button discipline
 * Ross asked for in his Round-7 feedback.
 */
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
      className="inline-flex items-center gap-2"
    >
      <ToggleButton
        active={mode === "list"}
        onClick={() => onChange("list")}
        ariaLabel="List view"
      >
        <List size={12} strokeWidth={2} aria-hidden />
        <span>LIST</span>
      </ToggleButton>
      <ToggleButton
        active={mode === "grid"}
        onClick={() => onChange("grid")}
        ariaLabel="Grid view"
      >
        <LayoutGrid size={12} strokeWidth={2} aria-hidden />
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
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1 min-h-[28px]",
        "font-mono text-2xs font-bold uppercase tracking-[0.08em]",
        "border rounded-sm transition-colors",
        active
          ? "bg-[var(--color-yellow)] text-[var(--color-bg)] border-[var(--color-yellow)]"
          : "text-[var(--color-yellow)] border-[var(--color-yellow)] hover:bg-[color-mix(in_srgb,var(--color-yellow)_14%,transparent)]",
      )}
    >
      {children}
    </button>
  );
}
