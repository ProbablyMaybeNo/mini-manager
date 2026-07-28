"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, ProgressBar } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { formatMinutes } from "@/lib/palette";
import type { InspoRef, Project, Recipe, SessionStats } from "@/lib/types";
import { AddPaintCard, AddPaintTile, PaintCard, PaintTile } from "./PaintCard";
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
  const router = useRouter();
  const initialStep = project
    ? (project.modelsComplete ??
      Math.round((project.completionPercent / 100) * modelCount))
    : 0;
  const [step, setStep] = useState(initialStep);

  // Re-seed the PROGRESS counter when the focused project changes (0Uwugdcrguxb).
  // `step` is a useState initial-value, so without this it kept the previous
  // project's value after switching focus via the "+ Focus" dropdown — the
  // header/recipe updated but the x/N progress didn't, reading as "the dropdown
  // won't change my focus". Mirrors the inspo re-seed in the route controller.
  useEffect(() => {
    setStep(initialStep);
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="flex h-full flex-col gap-4 p-3 md:gap-6 md:p-6">
        <PageHeader title="FOCUS" tagline={TAGLINE} />
        <div>{picker}</div>
        <Panel label="NO SESSION" className="max-w-md p-6">
          <p className="font-body text-body text-fg">▸ No project in focus.</p>
          <p className="mt-2 font-body text-body text-fg">
            Pick a project from the <span className="text-cyan-lite">+ Focus</span> menu above, or
            launch the bench from Projects.
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
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 md:gap-5 md:p-6">
      {/* Title is desktop-only on the bench (Ross, 2026-07-27) — the burger bar
          above already says where you are, and the whole point of Focus on a
          phone is to see the recipe and the timer without scrolling. */}
      <div className="hidden md:block">
        <PageHeader title="FOCUS" tagline={TAGLINE} />
      </div>

      {/* Stopwatch leads the page and, on phones, STICKS to the top of the
          scroll container — a painter can stop/start mid-model without
          scrolling back up, which was the whole complaint. One instance, two
          renderings (see Stopwatch), so the running timer is never duplicated. */}
      <div className="sticky top-0 z-30 -mx-3 bg-bg px-3 pb-2 pt-1 md:static md:mx-0 md:bg-transparent md:p-0">
        <Stopwatch
          onLogSession={onLogSession}
          totalLabel={projectMinutes != null ? formatMinutes(projectMinutes) : undefined}
        />
      </div>

      {/* Focus picker — pick any project / sub-project, or clear the bench.
          The model count rides here on phones because the pinned header below
          (which carried it) is desktop-only now: it was a full-width band whose
          only job was reprinting the project name 41px under the picker that
          already showed it (MUX-005 / MUX-009). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {picker}
        <span className="shrink-0 font-num2 text-num2 tabular-nums text-cyan-lite md:hidden">
          ×{modelCount}
        </span>
      </div>

      {/* Pinned project header — bound to the focused project (MM-21).
          Desktop-only; see above. */}
      <Panel className="hidden items-center justify-between gap-3 p-2.5 md:flex md:p-4" glow>
        <span className="min-w-0 truncate font-h1 text-h1 uppercase text-green text-glow-green">
          {project.title} <span className="text-cyan-lite">×{modelCount}</span>
        </span>
        <div className="hidden flex-wrap items-center justify-end gap-x-4 gap-y-1 label-osd text-fg md:flex">
          {projectMinutes != null && (
            <span className="text-fg-muted">Time {formatMinutes(projectMinutes)}</span>
          )}
          <span>Today {formatMinutes(stats.todayMinutes)}</span>
          <span>Week {formatMinutes(stats.weekMinutes)}</span>
          <span className="text-yellow">Streak {stats.streakDays}d</span>
        </div>
      </Panel>

      {/* RECIPE — small squares on a phone so the whole scheme is on screen at
          once (PaintTile), the full labelled cards from md up (PaintCard). */}
      <Panel label="RECIPE" className="flex flex-col gap-3 p-2.5 md:p-4">
        {recipe && recipe.slots.length > 0 ? (
          <>
            <ul className="flex flex-wrap gap-2 md:hidden">
              {recipe.slots.map((slot, i) => (
                <PaintTile key={i} slot={slot} />
              ))}
              <AddPaintTile onClick={onAddPaint} />
            </ul>
            <div className="hidden flex-wrap gap-3 md:flex">
              {recipe.slots.map((slot, i) => (
                <PaintCard key={i} slot={slot} />
              ))}
              <AddPaintCard onClick={onAddPaint} />
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-body text-body text-fg">
              No recipe attached — add paints to build this scheme.
            </p>
            <ul className="flex md:hidden">
              <AddPaintTile onClick={onAddPaint} />
            </ul>
            <div className="hidden md:block">
              <AddPaintCard onClick={onAddPaint} />
            </div>
          </div>
        )}
      </Panel>

      {/* Notes. The empty state used to name the recipe editor without offering
          a way to reach it (MUX-025) — it's a button now. */}
      <Panel label="NOTES" className="p-2.5 md:p-4">
        {recipe?.notes?.trim() ? (
          <p className="whitespace-pre-line font-body text-body leading-relaxed text-fg">
            {recipe.notes}
          </p>
        ) : recipe ? (
          <button
            type="button"
            onClick={() => router.push(`/recipes/${recipe.id}`)}
            className="text-left font-body text-body leading-relaxed text-fg-dim underline-offset-4 transition-colors hover:text-cyan-lite hover:underline focus:outline-none focus-visible:text-cyan-lite focus-visible:underline"
          >
            No notes yet — add technique notes in the recipe editor ›
          </button>
        ) : (
          <p className="font-body text-body leading-relaxed text-fg-dim">
            No recipe attached yet.
          </p>
        )}
      </Panel>

      {/* Progress — bound to the focused project (MM-21). */}
      <Panel label="PROGRESS" className="flex flex-col justify-center gap-3 p-2.5 md:p-4">
        <div className="flex items-center justify-between">
          <span className="label-osd text-fg">Models</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Decrease models painted"
              onClick={() => bumpStep(-1)}
              className="inline-flex min-h-9 min-w-11 items-center justify-center border border-cyan/60 px-2 font-button text-button text-cyan-lite hover:bg-cyan/10 md:min-h-6 md:min-w-6"
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
              className="inline-flex min-h-9 min-w-11 items-center justify-center border border-cyan/60 px-2 font-button text-button text-cyan-lite hover:bg-cyan/10 md:min-h-6 md:min-w-6"
            >
              +
            </button>
          </div>
        </div>
        <ProgressBar percent={percent} />
      </Panel>

      {/* Inspiration board — thumbnails open a popup overlay on double-click
          (ZsWm). Last on the page: it's the one section a painter scrolls TO,
          not one they need mid-brushstroke. */}
      <Panel label="INSPIRATION" className="flex flex-col gap-3 p-2.5 md:p-4">
        <InspoBoard inspo={inspo} onAddInspo={onAddInspo} onRemoveInspo={onRemoveInspo} />
      </Panel>
    </div>
  );
}
