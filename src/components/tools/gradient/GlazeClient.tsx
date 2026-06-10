"use client";

import { useEffect, useMemo, useState } from "react";
import type { Paint } from "@/lib/paints/types";
import { loadPaints } from "@/lib/paints/loader";
import { findClosestPaints, type MatchResult } from "@/lib/tools/match/find";
import { normaliseHex } from "@/lib/palettes/cascade";
import { mixLayers } from "@/lib/tools/layering/opticalMix";
import {
  recommendUndercoat,
  GOALS,
  PAINT_TYPE_FILTERS,
  type Goal,
} from "@/lib/tools/layering/undercoat";
import { ToolShell } from "@/components/tools/ToolShell";
import { ToolFooterActions } from "@/components/tools/ToolFooterActions";
import type { ToolPaletteSwatch } from "@/lib/tools/types";
import { ColorPickerDialog } from "@/components/ui/ColorPickerDialog";
import { Button } from "@/components/ui/Button";
import { GlazeVenn } from "./GlazeVenn";

const HEX6 = /^#[0-9A-F]{6}$/;

const DEFAULT_TOP = "#F2C200"; // a warm yellow glaze
const DEFAULT_UNDERCOAT = "#E0218A"; // magenta — the canonical undercoat

function HexField({
  label,
  value,
  onChange,
  onPick,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onPick: () => void;
}) {
  const preview = HEX6.test(value) ? value : "var(--color-bg-elevated)";
  return (
    <div className="space-y-1">
      <span className="section-title mb-0 pb-0 border-0">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPick}
          aria-label={`Pick a ${label.toLowerCase()} colour`}
          className="inline-block w-9 h-9 rounded-sm border shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] hover:ring-2 hover:ring-[var(--color-accent)]"
          style={{ background: preview, borderColor: "var(--color-border-strong)" }}
        />
        <label
          className="flex-1 min-w-0 rounded-sm border flex items-center gap-2 px-2 py-1.5 focus-within:border-[var(--color-accent)] transition-colors motion-reduce:transition-none"
          style={{ borderColor: "color-mix(in srgb, var(--color-cyan) 22%, var(--color-border))" }}
        >
          <span aria-hidden className="font-mono text-xs text-[var(--color-cyan)]">▸</span>
          <input
            type="text"
            value={value}
            aria-label={`${label} hex`}
            onChange={(e) => {
              const next = e.target.value.trim();
              onChange(normaliseHex(next) ?? next.toUpperCase());
            }}
            maxLength={7}
            className="flex-1 min-w-0 bg-transparent font-mono text-xs text-[var(--color-fg)] focus:outline-none"
          />
        </label>
        <Button type="button" onClick={onPick} variant="ghost" size="sm">
          Pick
        </Button>
      </div>
    </div>
  );
}

function ThinnessSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="section-title mb-0 pb-0 border-0">
        {label} · {Math.round(value * 100)}%
      </span>
      <input
        type="range"
        min={5}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full"
        aria-label={`${label} opacity`}
      />
    </div>
  );
}

function MatchLine({ caption, hex, match }: { caption: string; hex: string; match: MatchResult | null }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block w-5 h-5 rounded-sm border shrink-0"
        style={{ background: hex, borderColor: "var(--color-border-strong)" }}
        aria-hidden
      />
      <span className="font-mono text-2xs uppercase tracking-[0.12em] text-[var(--color-fg-subtle)] w-20 shrink-0">
        {caption}
      </span>
      <span className="font-mono text-xs text-[var(--color-fg)] truncate">
        {match ? `${match.paint.brand} · ${match.paint.name}` : hex}
        {match ? (
          <span className="text-[var(--color-fg-subtle)]"> · ΔE {match.deltaE.toFixed(1)}</span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Glaze mode — recommend an undercoat for a transparent top paint to push
 * the result a chosen direction (warmer / glow / candy …), shown as the
 * optical-mix Venn. Reuses the catalog loader + ΔE matcher + recipe footer.
 */
export function GlazeClient() {
  const [top, setTop] = useState(DEFAULT_TOP);
  const [undercoat, setUndercoat] = useState(DEFAULT_UNDERCOAT);
  const [topAlpha, setTopAlpha] = useState(0.85);
  const [undercoatAlpha, setUndercoatAlpha] = useState(0.35);
  const [goal, setGoal] = useState<Goal | null>("warmer");
  const [rationale, setRationale] = useState(
    "A thin magenta undercoat subtracts green from the yellow, warming it toward rich amber.",
  );
  const [matchTypes, setMatchTypes] = useState<ReadonlyArray<string>>(
    PAINT_TYPE_FILTERS.opaqueBase,
  );
  const [paints, setPaints] = useState<ReadonlyArray<Paint>>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [pickerLane, setPickerLane] = useState<"Top" | "Undercoat" | null>(null);

  useEffect(() => {
    let mounted = true;
    loadPaints()
      .then((rows) => mounted && setPaints(rows))
      .catch(() => {})
      .finally(() => mounted && setCatalogLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  // Recommend an undercoat whenever a goal is active and the top changes.
  const applyGoal = (g: Goal, topHex: string) => {
    const rec = recommendUndercoat(topHex, g);
    setUndercoat(rec.undercoatHex);
    setRationale(rec.rationale);
    setMatchTypes(rec.matchTypes);
  };

  useEffect(() => {
    if (goal && HEX6.test(top)) applyGoal(goal, top);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, top]);

  const resultHex = useMemo(
    () =>
      mixLayers([
        { hex: undercoat, alpha: undercoatAlpha },
        { hex: top, alpha: topAlpha },
      ]),
    [undercoat, top, undercoatAlpha, topAlpha],
  );

  const matchOf = (hex: string, types?: ReadonlyArray<string>): MatchResult | null => {
    if (catalogLoading || paints.length === 0 || !HEX6.test(hex)) return null;
    return findClosestPaints(hex, paints, { limit: 1, types: types?.length ? types : undefined })[0] ?? null;
  };

  const undercoatMatch = useMemo(() => matchOf(undercoat, matchTypes), [undercoat, matchTypes, paints, catalogLoading]);
  const topMatch = useMemo(() => matchOf(top, PAINT_TYPE_FILTERS.transparent), [top, paints, catalogLoading]);
  const resultMatch = useMemo(() => matchOf(resultHex), [resultHex, paints, catalogLoading]);

  const footerSwatches: ReadonlyArray<ToolPaletteSwatch> = useMemo(
    () => [
      {
        hex: undercoat,
        name: undercoatMatch?.paint.name ?? "Undercoat",
        sourcePaintId: undercoatMatch?.confidence === "high" ? undercoatMatch.paint.id : undefined,
      },
      {
        hex: top,
        name: topMatch?.paint.name ?? "Glaze",
        sourcePaintId: topMatch?.confidence === "high" ? topMatch.paint.id : undefined,
      },
    ],
    [undercoat, top, undercoatMatch, topMatch],
  );

  const handlePickerSelect = (hex: string) => {
    const upper = hex.toUpperCase();
    if (pickerLane === "Top") setTop(upper);
    else if (pickerLane === "Undercoat") {
      setUndercoat(upper);
      setGoal(null); // manual override clears the active goal
      setRationale("Manual undercoat — set a goal to get a recommendation.");
    }
  };

  return (
    <>
      <ToolShell
        input={
          <div className="space-y-4">
            <header className="space-y-2">
              <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)]">
                SYS ▸ LAYERING / GLAZE
              </p>
              <h1 className="text-3xl tracking-wide">GLAZE</h1>
              <p className="text-2xs font-sans text-[var(--color-fg-muted)] leading-snug">
                Pick the transparent paint you want on top, then a goal — the tool
                recommends the undercoat to lay beneath it and previews the result.
              </p>
            </header>

            <HexField label="Top glaze" value={top} onChange={setTop} onPick={() => setPickerLane("Top")} />

            <div className="space-y-1">
              <span className="section-title mb-0 pb-0 border-0">Goal</span>
              <div className="flex flex-wrap gap-1.5">
                {GOALS.map((g) => {
                  const active = goal === g.goal;
                  return (
                    <button
                      key={g.goal}
                      type="button"
                      onClick={() => setGoal(g.goal)}
                      title={g.blurb}
                      aria-pressed={active}
                      className="glaze-chip text-2xs"
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <HexField
              label="Undercoat"
              value={undercoat}
              onChange={(v) => {
                setUndercoat(v);
                setGoal(null);
              }}
              onPick={() => setPickerLane("Undercoat")}
            />

            <ThinnessSlider label="Undercoat thinness" value={undercoatAlpha} onChange={setUndercoatAlpha} />
            <ThinnessSlider label="Top thinness" value={topAlpha} onChange={setTopAlpha} />
          </div>
        }
        output={
          <div className="space-y-4">
            <header>
              <h2 className="section-title">Optical mix</h2>
            </header>

            <GlazeVenn
              undercoat={{ hex: undercoat, alpha: undercoatAlpha, label: "Undercoat" }}
              top={{ hex: top, alpha: topAlpha, label: "Top glaze" }}
              onPick={(region) => {
                if (region === "top") setPickerLane("Top");
                else if (region === "undercoat") setPickerLane("Undercoat");
              }}
            />

            <p className="text-2xs font-sans text-[var(--color-fg-muted)] leading-snug border-l-2 border-[var(--color-cyan)] pl-2">
              {rationale}
            </p>

            <div className="space-y-1.5">
              <MatchLine caption="Undercoat" hex={undercoat} match={undercoatMatch} />
              <MatchLine caption="Top glaze" hex={top} match={topMatch} />
              <MatchLine caption="Result ≈" hex={resultHex} match={resultMatch} />
            </div>

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
            defaultPaletteName="Undercoat + glaze"
          />
        }
      />
      <ColorPickerDialog
        open={pickerLane !== null}
        onClose={() => setPickerLane(null)}
        initialHex={pickerLane === "Top" ? top : pickerLane === "Undercoat" ? undercoat : null}
        contextLabel={pickerLane ?? undefined}
        onSelect={handlePickerSelect}
      />
    </>
  );
}
