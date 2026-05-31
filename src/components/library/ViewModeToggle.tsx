"use client";

import { clsx } from "clsx";
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
        <span aria-hidden className="text-base leading-none">≡</span>
        <span>LIST</span>
      </ToggleButton>
      <span aria-hidden className="w-px bg-[var(--color-border-strong)]" />
      <ToggleButton
        active={mode === "grid"}
        onClick={() => onChange("grid")}
        ariaLabel="Grid view"
      >
        <span aria-hidden className="text-base leading-none">▦</span>
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
        "inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs uppercase tracking-wider",
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
