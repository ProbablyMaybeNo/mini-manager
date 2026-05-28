"use client";

import { clsx } from "clsx";
import type { MatchResult } from "@/lib/tools/match/find";

interface Step {
  hex: string;
  match: MatchResult | null;
}

interface Props {
  steps: ReadonlyArray<Step>;
}

/**
 * Horizontal ramp + per-step labels. Renders a single bar divided into
 * N segments; hex label + closest-paint name sit under each segment.
 * Shadow-to-highlight, left-to-right.
 */
export function RampDisplay({ steps }: Props) {
  if (steps.length === 0) {
    return (
      <p className="text-xs font-sans text-[var(--color-fg-muted)] frame px-3 py-6 text-center">
        Enter base + shadow + highlight to render a ramp.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex w-full h-16 frame-strong overflow-hidden">
        {steps.map((s, i) => (
          <div
            key={i}
            className="flex-1"
            style={{ background: s.hex }}
            aria-hidden
          />
        ))}
      </div>
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((s, i) => (
          <div key={i} className="space-y-0.5 text-center">
            <div className="font-mono text-2xs text-[var(--color-fg)]">
              {s.hex}
            </div>
            {s.match ? (
              <div
                className={clsx(
                  "text-2xs font-mono truncate",
                  s.match.confidence === "high" && "text-[var(--color-green)]",
                  s.match.confidence === "medium" && "text-[var(--color-amber)]",
                  s.match.confidence === "low" && "text-[var(--color-fg-muted)]",
                )}
                title={`${s.match.paint.brand} ${s.match.paint.name} · ΔE ${s.match.deltaE.toFixed(1)}`}
              >
                {s.match.paint.name}
              </div>
            ) : (
              <div className="text-2xs font-mono text-[var(--color-fg-subtle)]">
                —
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
