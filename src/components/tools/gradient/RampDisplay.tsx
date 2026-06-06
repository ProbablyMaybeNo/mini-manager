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
      <p className="text-xs font-sans text-[var(--color-fg-muted)] panel px-3 py-6 text-center">
        Enter base + shadow + highlight to render a ramp.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {/* Ramp bar framed as a terminal panel; each segment is a color bar
          with its hex in black text overlaid (§7.2). */}
      <div className="relative panel panel-ticks p-1">
        <div className="flex w-full h-16 overflow-hidden">
          {steps.map((s, i) => (
            <div
              key={i}
              className="flex-1 grid place-items-center"
              style={{ background: s.hex }}
            >
              <span className="font-mono text-[10px] text-black/80 px-0.5 truncate">
                {s.hex}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((s, i) => (
          <div key={i} className="space-y-0.5 text-center">
            {s.match ? (
              <div
                className={clsx(
                  "text-2xs font-mono truncate",
                  s.match.confidence === "high" && "text-[var(--color-green)]",
                  s.match.confidence === "medium" && "text-[var(--color-amber)]",
                  s.match.confidence === "low" && "text-[var(--color-fg-muted)]",
                )}
                title={`${s.match.paint.brand} ${s.match.paint.name} · match ${s.match.deltaE.toFixed(1)} (0 = exact, ≤2 = imperceptible)`}
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
