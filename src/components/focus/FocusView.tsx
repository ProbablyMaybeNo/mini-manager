"use client";

import { useState } from "react";
import { Button, Input, Panel, ProgressBar } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import type { InspoRef, Project, Recipe, SessionStats } from "@/lib/types";
import { AddPaintCard, PaintCard } from "./PaintCard";
import { Stopwatch } from "./Stopwatch";

export function FocusView({
  project,
  recipe,
  stats,
  modelCount,
  inspo,
  onLogSession,
  onStepChange,
  onAddPaint,
  onAddInspo,
  onRemoveInspo,
}: {
  project: Project | null;
  recipe: Recipe | null;
  stats: SessionStats;
  modelCount: number;
  /** Controlled inspo list (parent owns persistence + optimistic state). */
  inspo: InspoRef[];
  onLogSession: (seconds: number) => void;
  onStepChange?: (step: number) => void;
  onAddPaint?: () => void;
  onAddInspo?: (url: string) => void;
  onRemoveInspo?: (id: string) => void;
}) {
  const initialStep = project
    ? (project.modelsComplete ??
      Math.round((project.completionPercent / 100) * modelCount))
    : 0;
  const [step, setStep] = useState(initialStep);
  const [inspoUrl, setInspoUrl] = useState("");

  const TAGLINE =
    "Painting session companion — recipe, technique, progress, time, and inspiration, all in one place.";

  if (!project) {
    return (
      <div className="flex h-full flex-col gap-6 p-6">
        <PageHeader title="FOCUS" tagline={TAGLINE} />
        <Panel label="NO SESSION" className="max-w-md p-6">
          <p className="font-mono text-sm text-fg-dim">▸ No project in focus.</p>
          <p className="mt-2 font-mono text-xs text-fg-faint">
            Launch the bench from a project on the Dashboard.
          </p>
        </Panel>
      </div>
    );
  }

  function bumpStep(delta: number) {
    const next = Math.max(0, Math.min(modelCount, step + delta));
    setStep(next);
    onStepChange?.(next);
  }

  function addInspo() {
    const url = inspoUrl.trim();
    if (!url) return;
    onAddInspo?.(url);
    setInspoUrl("");
  }

  const percent = modelCount ? Math.round((step / modelCount) * 100) : 0;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
      <PageHeader title="FOCUS" tagline={TAGLINE} />

      {/* Pinned project header */}
      <Panel className="flex items-center justify-between p-4" glow>
        <span className="font-display text-lg uppercase text-green text-glow-green">
          {project.title} <span className="text-cyan">×{modelCount}</span>
        </span>
        <span aria-hidden className="font-osd text-2xl text-cyan">
          ⛯
        </span>
      </Panel>

      {/* Recipe paints as cards */}
      <Panel label="RECIPE" className="p-4">
        <div className="flex gap-3 overflow-x-auto pb-1">
          {recipe && recipe.slots.length > 0 ? (
            recipe.slots.map((slot, i) => <PaintCard key={i} slot={slot} />)
          ) : (
            <p className="py-8 font-mono text-xs text-fg-faint">
              No recipe attached — add paints to build this scheme.
            </p>
          )}
          <AddPaintCard onClick={onAddPaint} />
        </div>
      </Panel>

      {/* Notes */}
      <Panel label="NOTES" className="p-4">
        <p className="whitespace-pre-line font-mono text-sm leading-relaxed text-fg-dim">
          {recipe?.notes?.trim()
            ? recipe.notes
            : "No notes yet — add technique notes in the recipe editor."}
        </p>
      </Panel>

      {/* Stopwatch + progress */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Stopwatch stats={stats} onLogSession={onLogSession} />
        <Panel label="PROGRESS" className="flex flex-col justify-center gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="font-osd text-[11px] uppercase tracking-[0.18em] text-fg-dim">
              Models
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Decrease models painted"
                onClick={() => bumpStep(-1)}
                className="border border-cyan/60 px-2 font-osd text-cyan hover:bg-cyan/10"
              >
                −
              </button>
              <span className="font-mono text-sm tabular-nums text-fg">
                {step}/{modelCount}
              </span>
              <button
                type="button"
                aria-label="Increase models painted"
                onClick={() => bumpStep(1)}
                className="border border-cyan/60 px-2 font-osd text-cyan hover:bg-cyan/10"
              >
                +
              </button>
            </div>
          </div>
          <ProgressBar percent={percent} />
        </Panel>
      </div>

      {/* Inspiration board */}
      <Panel label="INSPIRATION" className="flex flex-col gap-3 p-4">
        <div className="flex gap-2">
          <Input
            name="focus-inspo"
            placeholder="Paste URL to add inspo"
            value={inspoUrl}
            onChange={(e) => setInspoUrl(e.target.value)}
            containerClassName="flex-1"
            onKeyDown={(e) => e.key === "Enter" && addInspo()}
          />
          <Button variant="secondary" onClick={addInspo}>
            Add
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {Array.from({ length: Math.max(7, inspo.length) }).map((_, i) => {
            const ref = inspo[i];
            return (
              <div
                key={ref?.id || i}
                className="group relative flex aspect-square items-center justify-center border border-cyan/40 bg-bg-raised/30 p-1"
              >
                {ref ? (
                  <>
                    {/* MM-26 — render the pasted reference as an actual image.
                        Plain <img> (not next/image) so arbitrary external hosts
                        load without the optimizer's host allowlist; on a load
                        error we fall back to showing the URL text. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ref.url}
                      alt={`Reference ${i + 1}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.style.display = "none";
                        const fallback = el.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = "block";
                      }}
                    />
                    <span
                      className="truncate px-1 font-mono text-[9px] text-fg-dim"
                      style={{ display: "none" }}
                    >
                      {ref.url}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove reference ${i + 1}`}
                      onClick={() => onRemoveInspo?.(ref.id)}
                      className="absolute right-0.5 top-0.5 z-10 bg-bg/70 px-0.5 font-osd text-[10px] text-fg-faint hover:text-red"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <span aria-hidden className="font-osd text-fg-faint/30">
                    +
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
