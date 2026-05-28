"use client";

import { useEffect, useMemo, useState } from "react";
import type { Paint } from "@/lib/paints/types";
import { loadPaints } from "@/lib/paints/loader";
import {
  buildRamp,
  MAX_STEPS,
  MIN_STEPS,
} from "@/lib/tools/gradient/interpolate";
import {
  findClosestPaints,
  type MatchResult,
} from "@/lib/tools/match/find";
import { normaliseHex } from "@/lib/palettes/cascade";
import { ToolShell } from "@/components/tools/ToolShell";
import { RampDisplay } from "./RampDisplay";

const HEX6 = /^#[0-9A-F]{6}$/;

// Macragge Blue defaults — sensible first-render so the painter sees a
// usable ramp without thinking.
const DEFAULT_BASE = "#0E4A8A";
const DEFAULT_SHADOW = "#072547";
const DEFAULT_HIGHLIGHT = "#4A9EFF";
const DEFAULT_STEPS = 5;

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
}

function ColorInput({ label, value, onChange }: ColorInputProps) {
  const preview = HEX6.test(value) ? value : "var(--color-bg-elevated)";
  return (
    <div className="space-y-1">
      <label className="block section-title mb-0 pb-0 border-0">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block w-9 h-9 rounded-sm border shrink-0"
          style={{
            background: preview,
            borderColor: "var(--color-border-strong)",
          }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const next = e.target.value.trim();
            const normalised = normaliseHex(next);
            onChange(normalised ?? next.toUpperCase());
          }}
          maxLength={7}
          placeholder="#0E4A8A"
          className="flex-1 px-2 py-1.5 font-mono text-xs bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-green)]"
        />
      </div>
    </div>
  );
}

/**
 * Build a 3-7 step Lab-space ramp from a base + shadow + highlight.
 * Closest paint per step surfaces under each swatch — the painter
 * gets transition planning + a buy list in one view.
 */
export function GradientClient() {
  const [base, setBase] = useState(DEFAULT_BASE);
  const [shadow, setShadow] = useState(DEFAULT_SHADOW);
  const [highlight, setHighlight] = useState(DEFAULT_HIGHLIGHT);
  const [steps, setSteps] = useState(DEFAULT_STEPS);
  const [paints, setPaints] = useState<ReadonlyArray<Paint>>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadPaints()
      .then((rows) => {
        if (mounted) setPaints(rows);
      })
      .catch(() => {
        /* no-op */
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const rampHexes = useMemo(() => {
    if (!HEX6.test(base) || !HEX6.test(shadow) || !HEX6.test(highlight)) {
      return [];
    }
    return buildRamp({ base, shadow, highlight, steps });
  }, [base, shadow, highlight, steps]);

  const stepsWithMatches = useMemo(() => {
    if (catalogLoading || paints.length === 0) {
      return rampHexes.map((hex) => ({ hex, match: null as MatchResult | null }));
    }
    return rampHexes.map((hex) => {
      const matches = findClosestPaints(hex, paints, { limit: 1 });
      return { hex, match: matches[0] ?? null };
    });
  }, [rampHexes, paints, catalogLoading]);

  return (
    <ToolShell
      input={
        <div className="space-y-4">
          <header className="space-y-1">
            <h1 className="text-xl glow-green">┌─ GRADIENT ─</h1>
            <p className="text-2xs font-sans text-[var(--color-fg-muted)]">
              Pick base, shadow, and highlight. The ramp is interpolated
              in Lab so transitions feel even across the eye, not just
              the maths.
            </p>
          </header>

          <ColorInput label="Shadow" value={shadow} onChange={setShadow} />
          <ColorInput label="Base" value={base} onChange={setBase} />
          <ColorInput label="Highlight" value={highlight} onChange={setHighlight} />

          <div className="space-y-1">
            <label
              htmlFor="gradient-steps"
              className="block section-title mb-0 pb-0 border-0"
            >
              Steps · {steps}
            </label>
            <div className="flex items-center gap-3">
              <input
                id="gradient-steps"
                type="range"
                min={MIN_STEPS}
                max={MAX_STEPS}
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                className="flex-1"
              />
              <span className="font-mono text-xs text-[var(--color-fg-muted)] w-12 text-right">
                {MIN_STEPS}–{MAX_STEPS}
              </span>
            </div>
          </div>
        </div>
      }
      output={
        <div className="space-y-4">
          <header>
            <h2 className="section-title">Ramp · {rampHexes.length} steps</h2>
          </header>

          <RampDisplay steps={stepsWithMatches} />

          {catalogLoading ? (
            <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
              Loading catalog — paint names will populate when ready.
            </p>
          ) : null}
        </div>
      }
      footer={
        <>
          <button
            type="button"
            disabled
            title="Save palette ships in P4.4 wiring"
            className="px-3 py-1.5 frame-strong text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] opacity-60"
          >
            [ Save palette ]
          </button>
          <button
            type="button"
            disabled
            title="Send to recipe ships in P4.7"
            className="px-3 py-1.5 frame-strong text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] opacity-60"
          >
            [ Send to recipe ]
          </button>
        </>
      }
    />
  );
}
