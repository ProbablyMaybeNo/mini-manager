"use client";

import { clsx } from "clsx";
import type { MatchResult } from "@/lib/tools/match/find";

interface Props {
  result: MatchResult;
  onUse?: (result: MatchResult) => void;
}

/**
 * One row in the cross-brand match table. Mono columns: swatch / brand /
 * name / line · type / ΔE + confidence dot / [ Use ].
 */
export function MatchResultsRow({ result, onUse }: Props) {
  const { paint, deltaE, confidence } = result;
  const confidenceColor =
    confidence === "high"
      ? "var(--color-green)"
      : confidence === "medium"
        ? "var(--color-amber)"
        : "var(--color-fg-muted)";

  return (
    <div className="grid grid-cols-[24px_1fr_72px_56px] items-center gap-2 px-2 py-1.5 border-b border-[var(--color-border)] hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]">
      <span
        aria-hidden
        className="inline-block w-5 h-5 rounded-sm border"
        style={{
          background: paint.hex,
          borderColor: "var(--color-border-strong)",
        }}
      />
      <div className="min-w-0">
        <div className="font-mono text-xs text-[var(--color-fg)] truncate">
          {paint.brand} {paint.name}
        </div>
        <div className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider truncate">
          {paint.line ?? paint.type}
        </div>
      </div>
      <div className="flex items-center gap-1.5 justify-end">
        <span
          aria-hidden
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ background: confidenceColor }}
        />
        <span
          className={clsx(
            "font-mono text-xs",
            confidence === "high" && "text-[var(--color-green)]",
            confidence === "medium" && "text-[var(--color-amber)]",
            confidence === "low" && "text-[var(--color-fg-muted)]",
          )}
        >
          ΔE {deltaE.toFixed(1)}
        </span>
      </div>
      {onUse ? (
        <button
          type="button"
          onClick={() => onUse(result)}
          className="text-2xs font-mono uppercase tracking-wider text-[var(--color-cyan)] hover:glow-cyan tap-target px-2 frame"
        >
          [ Use ]
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
