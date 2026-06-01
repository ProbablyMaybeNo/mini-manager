"use client";

import { clsx } from "clsx";
import {
  HARMONIES,
  type HarmonyKey,
  buildHarmony,
} from "@/lib/tools/wheel/harmonies";

interface Props {
  active: HarmonyKey;
  onChange: (next: HarmonyKey) => void;
  /** P13.8 — primary HSL so each row can preview the actual swatch
   *  strip that harmony would produce against the current pick. */
  primary?: { hue: number; saturation: number; lightness: number };
}

/**
 * P13.8 — Harmony picker rewritten as a stacked-row list.
 *
 * Each harmony is its own row: a swatch-strip preview (computed from the
 * current primary HSL) + the harmony name in mono caps + a one-line
 * description. The active row is solid-fill green per P13.1 button
 * discipline; inactive rows are bg-elevated with hover lift. Clicking a
 * row makes that harmony active — same state machine, much clearer UX.
 *
 * Pre-P13.8 was a flex-wrap of 8 outlined chips that wrap-jumbled at
 * narrow widths and were hard to scan because the chip text WAS the only
 * information channel. The new layout previews the actual colour result
 * inline, so the painter can compare options visually without clicking
 * through each one.
 */
export function HarmonyPicker({ active, onChange, primary }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Harmony mode"
      className="space-y-1.5"
    >
      {HARMONIES.map((h) => {
        const isActive = h.key === active;
        // Preview swatches for this harmony. If we don't have a primary
        // HSL yet (initial render edge case), skip the preview and let
        // the row be name-only — same baseline as the legacy picker.
        const previewHexes = primary
          ? buildHarmony(
              h.key,
              primary.hue,
              primary.saturation,
              primary.lightness,
            )
          : [];
        return (
          <button
            key={h.key}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(h.key)}
            className={clsx(
              "w-full flex items-center gap-3 px-3 py-2 rounded-sm border transition-colors text-left tap-target",
              isActive
                ? "bg-[var(--color-green)] text-black border-[var(--color-green)]"
                : "bg-[var(--color-bg-elevated)] text-[var(--color-fg)] border-[var(--color-border-strong)] hover:border-[var(--color-green)] hover:bg-[color-mix(in_srgb,var(--color-green)_8%,var(--color-bg-elevated))]",
            )}
          >
            {/* Swatch strip preview — N segments side by side. */}
            <span
              aria-hidden
              className="flex shrink-0 h-7 w-20 frame-strong overflow-hidden"
            >
              {previewHexes.length > 0 ? (
                previewHexes.map((hex, i) => (
                  <span
                    key={`${h.key}-${i}`}
                    className="flex-1 border-l border-[var(--color-border)] first:border-l-0"
                    style={{ background: hex }}
                  />
                ))
              ) : (
                <span className="flex-1 bg-[var(--color-bg-panel)]" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div
                className={clsx(
                  "font-mono text-xs uppercase tracking-wider truncate",
                  isActive ? "font-semibold" : "",
                )}
              >
                {h.label}
              </div>
              <div
                className={clsx(
                  "text-2xs font-sans truncate",
                  isActive
                    ? "text-black/70"
                    : "text-[var(--color-fg-muted)]",
                )}
              >
                {h.description}
              </div>
            </div>
            <span
              className={clsx(
                "text-2xs font-mono uppercase tracking-wider shrink-0",
                isActive ? "text-black" : "text-[var(--color-fg-subtle)]",
              )}
              aria-hidden
            >
              {h.swatchCount} swatches
            </span>
          </button>
        );
      })}
    </div>
  );
}
