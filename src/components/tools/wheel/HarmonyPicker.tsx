"use client";

import { clsx } from "clsx";
import {
  HARMONIES,
  type HarmonyKey,
} from "@/lib/tools/wheel/harmonies";

interface Props {
  active: HarmonyKey;
  onChange: (next: HarmonyKey) => void;
}

/**
 * Eight-button bar that switches harmony mode. Compact mono labels;
 * description surfaces via title attribute so the bar fits at narrow
 * widths.
 */
export function HarmonyPicker({ active, onChange }: Props) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="radiogroup"
      aria-label="Harmony mode"
    >
      {HARMONIES.map((h) => {
        const isActive = h.key === active;
        return (
          <button
            key={h.key}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(h.key)}
            title={h.description}
            className={clsx(
              "px-2 py-1 text-2xs font-mono uppercase tracking-wider frame tap-target",
              isActive
                ? "border-[var(--color-accent)] text-[var(--color-accent)] glow-cyan"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]",
            )}
          >
            {h.label}
          </button>
        );
      })}
    </div>
  );
}
