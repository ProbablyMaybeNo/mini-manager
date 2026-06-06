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
import { ToolFooterActions } from "@/components/tools/ToolFooterActions";
import type { ToolPaletteSwatch } from "@/lib/tools/types";
import { RampDisplay } from "./RampDisplay";
import { ColorPickerDialog } from "@/components/ui/ColorPickerDialog";
import { Button } from "@/components/ui/Button";

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
  /** R7-4 — opens the shared ColorPickerDialog so the painter can
   *  seed this lane from the wheel, library, or eyedropper. */
  onOpenPicker: () => void;
}

function ColorInput({ label, value, onChange, onOpenPicker }: ColorInputProps) {
  const preview = HEX6.test(value) ? value : "var(--color-bg-elevated)";
  const inputId = `gradient-${label.toLowerCase()}-hex`;
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block section-title mb-0 pb-0 border-0">
        {label}
      </label>
      <div className="flex items-center gap-2">
        {/* P13.6 — the swatch preview is now a click-target that opens
            the ColorPicker. Keyboard accessible via Enter/Space. */}
        <button
          type="button"
          onClick={onOpenPicker}
          aria-label={`Open colour picker for ${label.toLowerCase()}`}
          title={`Pick a ${label.toLowerCase()} colour`}
          className="inline-block w-9 h-9 rounded-sm border shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] hover:ring-2 hover:ring-[var(--color-accent)]"
          style={{
            background: preview,
            borderColor: "var(--color-border-strong)",
          }}
        />
        {/* Terminal command-prompt hex field — cyan ▸ prompt + phosphor
            frame (matches Match + Library search idioms). */}
        <label
          className="flex-1 min-w-0 rounded-sm border flex items-center gap-2 px-2 py-1.5 focus-within:border-[var(--color-accent)] transition-colors motion-reduce:transition-none"
          style={{
            borderColor:
              "color-mix(in srgb, var(--color-cyan) 22%, var(--color-border))",
          }}
        >
          <span aria-hidden className="font-mono text-xs text-[var(--color-cyan)]">
            ▸
          </span>
          <input
            id={inputId}
            type="text"
            value={value}
            aria-label={`${label} hex`}
            onChange={(e) => {
              const next = e.target.value.trim();
              const normalised = normaliseHex(next);
              onChange(normalised ?? next.toUpperCase());
            }}
            maxLength={7}
            placeholder="#0E4A8A"
            className="flex-1 min-w-0 bg-transparent font-mono text-xs text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
          />
        </label>
        <Button
          type="button"
          onClick={onOpenPicker}
          variant="ghost"
          size="sm"
          aria-label={`Pick a ${label.toLowerCase()} colour`}
        >
          {/* UX-1312 — the prior ellipsis label truncated to nothing and
              never hinted at opening a colour picker. "Pick" matches the
              aria-label intent and fits without an ellipsis. */}
          Pick
        </Button>
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
  const [pickerLane, setPickerLane] = useState<
    "Shadow" | "Base" | "Highlight" | null
  >(null);

  const openPickerFor = (lane: "Shadow" | "Base" | "Highlight") =>
    setPickerLane(lane);
  const closePicker = () => setPickerLane(null);

  const initialPickerHex =
    pickerLane === "Shadow"
      ? shadow
      : pickerLane === "Base"
        ? base
        : pickerLane === "Highlight"
          ? highlight
          : null;

  const handlePickerSelect = (hex: string) => {
    const upper = hex.toUpperCase();
    if (pickerLane === "Shadow") setShadow(upper);
    else if (pickerLane === "Base") setBase(upper);
    else if (pickerLane === "Highlight") setHighlight(upper);
  };

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

  // Footer palette = the ramp itself; pin paint ids for sub-2 ΔE matches
  // so the recipe is attached directly to library entries.
  const footerSwatches: ReadonlyArray<ToolPaletteSwatch> = useMemo(() => {
    return stepsWithMatches.map((s) => ({
      hex: s.hex,
      sourcePaintId:
        s.match && s.match.confidence === "high" ? s.match.paint.id : undefined,
      name: s.match?.paint.name,
    }));
  }, [stepsWithMatches]);

  return (
    <>
    <ToolShell
      input={
        <div className="space-y-4">
          <header className="space-y-2">
            <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)]">
              SYS ▸ LAYERING / 04
            </p>
            <h1 className="text-3xl tracking-wide">LAYERING</h1>
            <p className="text-2xs font-sans text-[var(--color-fg-muted)] leading-snug">
              Pick base, shadow, and highlight. The ramp interpolates so the
              transitions feel even across the eye, not just the maths.
            </p>
          </header>

          <ColorInput
            label="Shadow"
            value={shadow}
            onChange={setShadow}
            onOpenPicker={() => openPickerFor("Shadow")}
          />
          <ColorInput
            label="Base"
            value={base}
            onChange={setBase}
            onOpenPicker={() => openPickerFor("Base")}
          />
          <ColorInput
            label="Highlight"
            value={highlight}
            onChange={setHighlight}
            onOpenPicker={() => openPickerFor("Highlight")}
          />

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
        <ToolFooterActions
          toolId="gradient"
          swatches={footerSwatches}
          defaultPaletteName="Layering ramp"
        />
      }
    />
    <ColorPickerDialog
      open={pickerLane !== null}
      onClose={closePicker}
      initialHex={initialPickerHex}
      contextLabel={pickerLane ?? undefined}
      onSelect={handlePickerSelect}
    />
    </>
  );
}
