"use client";

import { clsx } from "clsx";
import type { MatchResult } from "@/lib/tools/match/find";
import { Button } from "@/components/ui/Button";
import { SwatchAssignButton } from "@/components/tools/SwatchAssignButton";

interface Props {
  result: MatchResult;
  onUse?: (result: MatchResult) => void;
  /** P12.16 — render the universal "Assign ▾" affordance next to the
   *  Use button. Wired by MatchClient (which passes its toolId). */
  showAssign?: boolean;
}

/**
 * One row in the cross-brand match table. Mono columns: swatch / brand /
 * name / line · type / ΔE + confidence dot / [ Use ].
 */
export function MatchResultsRow({ result, onUse, showAssign }: Props) {
  const { paint, deltaE, confidence } = result;
  const confidenceColor =
    confidence === "high"
      ? "var(--color-green)"
      : confidence === "medium"
        ? "var(--color-amber)"
        : "var(--color-fg-muted)";

  return (
    <div
      role="row"
      className="grid grid-cols-[24px_1fr_72px_auto] items-center gap-2 px-2 py-1.5 border-b border-[var(--color-border)] hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]"
    >
      <span
        role="cell"
        aria-hidden
        className="inline-block w-5 h-5 rounded-sm border"
        style={{
          background: paint.hex,
          borderColor: "var(--color-border-strong)",
        }}
      />
      <div role="cell" className="min-w-0">
        <div className="font-mono text-xs text-[var(--color-fg)] truncate">
          {paint.brand} {paint.name}
        </div>
        <div className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider truncate">
          {paint.line ?? paint.type}
        </div>
      </div>
      <div role="cell" className="flex items-center gap-1.5 justify-end">
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
      <div role="cell" className="flex items-center gap-2 justify-end">
        {onUse ? (
          <Button
            type="button"
            onClick={() => onUse(result)}
            variant="secondary"
            size="sm"
          >
            Use
          </Button>
        ) : null}
        {showAssign ? (
          <SwatchAssignButton
            swatch={{
              hex: paint.hex,
              sourcePaintId: paint.id,
              name: `${paint.brand} ${paint.name}`,
            }}
            toolId="match"
          />
        ) : null}
      </div>
    </div>
  );
}
