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
  /** P13.6 — click the swatch cell to reseed the target hex via the
   *  ColorPicker (the parent owns the picker mount). */
  onPickColor?: (hex: string) => void;
}

/**
 * One row in the cross-brand match table. Mono columns: swatch / brand /
 * name / line · type / MATCH + confidence dot / [ Use ].
 */
export function MatchResultsRow({ result, onUse, showAssign, onPickColor }: Props) {
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
      {/* P13.6 — clicking the swatch reseeds the target hex via the
          parent's ColorPicker. Keyboard accessible. */}
      {onPickColor ? (
        <button
          role="cell"
          type="button"
          onClick={() => onPickColor(paint.hex)}
          aria-label={`Reseed match target from ${paint.brand} ${paint.name}`}
          title="Use this colour as target"
          className="inline-block w-5 h-5 rounded-sm border cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] hover:ring-2 hover:ring-[var(--color-accent)]"
          style={{
            background: paint.hex,
            borderColor: "var(--color-border-strong)",
          }}
        />
      ) : (
        <span
          role="cell"
          aria-hidden
          className="inline-block w-5 h-5 rounded-sm border"
          style={{
            background: paint.hex,
            borderColor: "var(--color-border-strong)",
          }}
        />
      )}
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
          title="0 = exact match, ≤2 = imperceptible, >5 = noticeably different. Industry standard (CIE ΔE 2000)."
        >
          {deltaE.toFixed(1)}
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
