"use client";

import { useState } from "react";
import { GradientClient } from "./GradientClient";
import { GlazeClient } from "./GlazeClient";

type Mode = "ramp" | "glaze";

const MODES: ReadonlyArray<{ id: Mode; label: string }> = [
  { id: "ramp", label: "Value ramp" },
  { id: "glaze", label: "Glaze / undercoat" },
];

/**
 * The Layering tool's two modes:
 *  - Value ramp: shadow → base → highlight opaque stacking (GradientClient).
 *  - Glaze: pick a transparent top paint + a goal, get the undercoat to lay
 *    beneath it, previewed as an optical-mix Venn (GlazeClient).
 */
export function LayeringClient() {
  const [mode, setMode] = useState<Mode>("ramp");

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Layering mode"
        className="inline-flex rounded-sm border border-[var(--color-border-strong)] divide-x divide-[var(--color-border-strong)] overflow-hidden"
      >
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(m.id)}
              className={active ? "mode-tab text-2xs is-active" : "mode-tab text-2xs"}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {mode === "ramp" ? <GradientClient /> : <GlazeClient />}
    </div>
  );
}
