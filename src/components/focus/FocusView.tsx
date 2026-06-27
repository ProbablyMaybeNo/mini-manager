"use client";

import { useState } from "react";
import { Panel, ProgressBar } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { formatMinutes } from "@/lib/palette";
import type { InspoRef, Project, Recipe, SessionStats } from "@/lib/types";
import { AddPaintCard, PaintCard } from "./PaintCard";
import { FocusPicker } from "./FocusPicker";
import { InspoBoard } from "./InspoBoard";
import { Stopwatch } from "./Stopwatch";

export function FocusView({
  project,
  projects,
  recipe,
  stats,
  modelCount,
  projectMinutes,
  inspo,
  onLogSession,
  onStepChange,
  onAddPaint,
  onAddInspo,
  onRemoveInspo,
  onFocusProject,
  onClearFocus,
}: {
  project: Project | null;
  /** Full project tree for the "+ Focus" picker (MM-23). */
  projects: Project[];
  recipe: Recipe | null;
  stats: SessionStats;
  modelCount: number;
  /** Total logged minutes for the focused project (A5qzb — per-project time). */
  projectMinutes?: number;
  /** Controlled inspo list (parent owns persistence + optimistic state). */
  inspo: InspoRef[];
  onLogSession: (seconds: number) => void;
  onStepChange?: (step: number) => void;
  onAddPaint?: () => void;
  onAddInspo?: (url: string) => void;
  onRemoveInspo?: (id: string) => void;
  /** Pin a project (or sub-project) to the bench (MM-23). */
  onFocusProject?: (id: string) => void;
  /** Clear the current focus (MM-23 — Remove Focus). */
  onClearFocus?: () => void;
}) {
  const initialStep = project
    ? (project.modelsComplete ??
      Math.round((project.completionPercent / 100) * modelCount))
    : 0;
  const [step, setStep] = useState(initialStep);

  const TAGLINE =
    "// your painting bench — recipe, progress, time, and inspiration for one model in one place";

  const picker = (
    <FocusPicker
      projects={projects}
      currentId={project?.id ?? null}
      onSelect={(id) => onFocusProject?.(id)}
      onClear={() => onClearFocus?.()}
    />
  );

  if (!project) {
    return (
      <div className="flex h-full flex-col gap-6 p-6">
        <PageHeader title="FOCUS" tagline={TAGLINE} />
        <div>{picker}</div>
        <Panel label="NO SESSION" className="max-w-md p-6">
          <p className="font-body text-body text-fg">▸ No project in focus.</p>
          <p className="mt-2 font-body text-body text-fg">
            Pick a project from the <span className="text-cyan">+ Focus</span> menu above, or
            launch the bench from the Dashboard.
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

  const percent = modelCount ? Math.round((step / modelCount) * 100) : 0;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
      <PageHeader title="FOCUS" tagline={TAGLINE} />

      {/* Focus picker — pick any project / sub-project, or remove focus. */}
      <div className="flex flex-wrap items-center justify-between gap-3">{picker}</div>

      {/* Pinned project header — bound to the focused project (MM-21). */}
      <Panel className="flex items-center justify-between p-4" glow>
        <span className="font-h1 text-h1 uppercase text-green text-glow-green">
          {project.title} <span className="text-cyan">×{modelCount}</span>
        </span>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 label-osd text-fg">
          {projectMinutes != null && (
            <span className="text-purple">Time {formatMinutes(projectMinutes)}</span>
          )}
          <span>Today {formatMinutes(stats.todayMinutes)}</span>
          <span>Week {formatMinutes(stats.weekMinutes)}</span>
          <span className="text-purple">Streak {stats.streakDays}d</span>
        </div>
      </Panel>

      {/* RECIPE box — responsive grid (MM-22) so the paint cards wrap on narrow
          benches. The redundant "Recipe Box" sub-heading was dropped: the panel
          label "RECIPE" already names the section (RuYiw7plQqDV). */}
      <Panel label="RECIPE" className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-3">
          {recipe && recipe.slots.length > 0 ? (
            recipe.slots.map((slot, i) => <PaintCard key={i} slot={slot} />)
          ) : (
            <p className="py-8 font-body text-body text-fg">
              No recipe attached — add paints to build this scheme.
            </p>
          )}
          <AddPaintCard onClick={onAddPaint} />
        </div>
      </Panel>

      {/* Notes */}
      <Panel label="NOTES" className="p-4">
        <p className="whitespace-pre-line font-body text-body leading-relaxed text-fg">
          {recipe?.notes?.trim()
            ? recipe.notes
            : "No notes yet — add technique notes in the recipe editor."}
        </p>
      </Panel>

      {/* Stopwatch gets its own dedicated section (D7 / A5qzb); progress sits
          beside it, bound to the focused project (MM-21). */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Stopwatch onLogSession={onLogSession} />
        <Panel label="PROGRESS" className="flex flex-col justify-center gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="label-osd text-fg">
              Models
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Decrease models painted"
                onClick={() => bumpStep(-1)}
                className="inline-flex min-h-6 min-w-6 items-center justify-center border border-cyan/60 px-2 font-button text-button text-cyan hover:bg-cyan/10"
              >
                −
              </button>
              {/* Dedicated 18px focus-progress token (aANKU9jIO6ih) — same
                  VT323 face as num2, sized only here so it doesn't touch the
                  shared num2 (calendar / Time / %). */}
              <span className="font-num2 text-focus-progress tabular-nums text-fg">
                {step}/{modelCount}
              </span>
              <button
                type="button"
                aria-label="Increase models painted"
                onClick={() => bumpStep(1)}
                className="inline-flex min-h-6 min-w-6 items-center justify-center border border-cyan/60 px-2 font-button text-button text-cyan hover:bg-cyan/10"
              >
                +
              </button>
            </div>
          </div>
          <ProgressBar percent={percent} />
        </Panel>
      </div>

      {/* Inspiration board — thumbnails open a popup overlay on double-click
          (ZsWm). */}
      <Panel label="INSPIRATION" className="flex flex-col gap-3 p-4">
        <InspoBoard inspo={inspo} onAddInspo={onAddInspo} onRemoveInspo={onRemoveInspo} />
      </Panel>
    </div>
  );
}
