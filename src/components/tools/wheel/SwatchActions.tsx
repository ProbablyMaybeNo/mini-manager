"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import type { Paint } from "@/lib/paints/types";
import { findClosestPaints, type MatchResult } from "@/lib/tools/match/find";
import { Button } from "@/components/ui/Button";

interface Props {
  hex: string;
  label: string;
  isPrimary?: boolean;
  isPinned?: boolean;
  paints: ReadonlyArray<Paint>;
  catalogLoading: boolean;
  onPin?: () => void;
  onCopy?: (hex: string) => void;
}

/**
 * One row in the swatch list under the wheel. Shows the hex, copy +
 * pin actions, and a [ Find in library ] toggle that expands a compact
 * Closest-paints subrow (top 5 by ΔE2000) — same UX as v1.
 */
export function SwatchActions({
  hex,
  label,
  isPrimary,
  isPinned,
  paints,
  catalogLoading,
  onPin,
  onCopy,
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const closest: ReadonlyArray<MatchResult> = useMemo(() => {
    if (!open || catalogLoading) return [];
    return findClosestPaints(hex, paints, { limit: 5 });
  }, [open, hex, paints, catalogLoading]);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(hex);
        setCopied(true);
        onCopy?.(hex);
      }
    } catch {
      // Clipboard refused — fall through; user can read the hex inline.
    }
  };

  return (
    <div
      className={clsx(
        "frame px-2 py-1.5",
        isPrimary && "border-[var(--color-accent)]",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block w-6 h-6 rounded-sm border shrink-0"
          style={{
            background: hex,
            borderColor: "var(--color-border-strong)",
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs text-[var(--color-fg)] truncate">
            {hex}
          </div>
          <div className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider">
            {label}
            {isPrimary ? " · primary" : ""}
            {isPinned ? " · pinned" : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="text-2xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-1.5"
          aria-label={`Copy ${hex}`}
        >
          {copied ? "✓" : "⧉"}
        </button>
        {onPin ? (
          <button
            type="button"
            onClick={onPin}
            className={clsx(
              "text-base font-mono tap-target px-1.5",
              isPinned
                ? "text-[var(--color-amber)] glow-amber"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-amber)]",
            )}
            aria-pressed={isPinned}
            aria-label={isPinned ? "Unpin swatch" : "Pin swatch"}
          >
            {isPinned ? "★" : "☆"}
          </button>
        ) : null}
        <Button
          type="button"
          onClick={() => setOpen((v) => !v)}
          variant="ghost"
          size="sm"
          aria-expanded={open}
        >
          {open ? "Close" : "Find in library"}
        </Button>
      </div>

      {open ? (
        <div
          role="listbox"
          aria-label={`Closest paints to ${hex}`}
          className="mt-2 border-t border-[var(--color-border)] pt-2 space-y-1"
        >
          {catalogLoading ? (
            <p className="text-2xs font-mono text-[var(--color-fg-muted)] px-1">
              Loading catalog…
            </p>
          ) : closest.length === 0 ? (
            <p className="text-2xs font-mono text-[var(--color-fg-muted)] px-1">
              No catalog matches.
            </p>
          ) : (
            closest.map((r) => (
              <div
                key={r.paint.id}
                className="flex items-center gap-2 px-1 py-0.5"
              >
                <span
                  aria-hidden
                  className="inline-block w-4 h-4 rounded-sm border shrink-0"
                  style={{
                    background: r.paint.hex,
                    borderColor: "var(--color-border-strong)",
                  }}
                />
                <span className="flex-1 min-w-0 text-2xs font-mono truncate text-[var(--color-fg)]">
                  {r.paint.brand} {r.paint.name}
                </span>
                <span
                  className={clsx(
                    "text-2xs font-mono shrink-0",
                    r.confidence === "high" && "text-[var(--color-green)]",
                    r.confidence === "medium" && "text-[var(--color-amber)]",
                    r.confidence === "low" && "text-[var(--color-fg-muted)]",
                  )}
                >
                  ΔE {r.deltaE.toFixed(1)}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
