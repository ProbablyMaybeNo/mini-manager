"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ProgressBar, Swatch } from "@/components/kit";
import { loadProjectCounters, setCounter } from "@/lib/actions/counters";
import { loadProjectRecipeCards, type ProjectRecipeCard } from "@/lib/actions/projectMeta";
import { progressPercent } from "@/lib/progress";
import { accentText, priorityAccent, STATUS_LABEL, statusAccent } from "@/lib/palette";
import { cn } from "@/lib/cn";
import type { CounterSnapshot, CounterStage } from "@/lib/counters/cascade";
import type { Project } from "@/lib/types";

/**
 * Unit panel (Figma 44:4) — the leaf workbench shown when a unit is drilled
 * from the Army panel. RECIPE swatches + Attach/Create, then the cumulative
 * stage steppers (Built/Primed/Painted/Completed) writing to the real
 * setCounter backend (cascade-clamped completed ≤ painted ≤ primed ≤ built ≤ N),
 * an OVERALL bar derived via the canonical progressPercent (so it rolls up to
 * the army), and a sticky GO PAINT! footer.
 *
 * The four Figma stages map onto the four CONTIGUOUS cascade stages so the
 * clamp is exact with no hidden gap:
 *   Built → build · Primed → prime · Painted → paint · Completed → base
 */
const STAGE_ROWS: { label: string; stage: CounterStage; column: keyof CounterSnapshot; accent: "green" | "cyan" | "purple" }[] = [
  { label: "Built", stage: "build", column: "buildCount", accent: "green" },
  { label: "Primed", stage: "prime", column: "primeCount", accent: "green" },
  { label: "Painted", stage: "paint", column: "paintCount", accent: "cyan" },
  { label: "Completed", stage: "base", column: "baseCount", accent: "purple" },
];

export function UnitPanelBody({
  project,
  backLabel,
  onBack,
  onAttachRecipe,
  onCreateRecipe,
  onGoPaint,
  onExpand,
}: {
  project: Project;
  /** Parent (army) title for the ‹ breadcrumb; omitted → "Back". */
  backLabel?: string;
  onBack?: () => void;
  onAttachRecipe?: (project: Project) => void;
  onCreateRecipe?: (project: Project) => void;
  onGoPaint?: (project: Project) => void;
  onExpand?: (project: Project) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [snap, setSnap] = useState<CounterSnapshot | null>(null);
  const [recipeCards, setRecipeCards] = useState<ProjectRecipeCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSnap(null);
    setRecipeCards(null);
    loadProjectCounters(project.id)
      .then((s) => alive && setSnap(s))
      .catch(() => {});
    loadProjectRecipeCards(project.id)
      .then((c) => alive && setRecipeCards(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [project.id]);

  const total = snap?.count ?? project.modelCount ?? 0;
  const overall = snap ? progressPercent(snap) : project.completionPercent;

  function step(stage: CounterStage, column: keyof CounterSnapshot, delta: 1 | -1) {
    if (!snap) return;
    const next = (snap[column] as number) + delta;
    if (next < 0 || next > total) return;
    // Optimistic update; the server returns the authoritative snapshot.
    setError(null);
    const optimistic = { ...snap, [column]: next };
    setSnap(optimistic);
    start(async () => {
      const res = await setCounter({ projectId: project.id, stage, value: next });
      if (!res.ok) {
        setError(res.error);
        setSnap(snap); // revert
        return;
      }
      if (res.data) setSnap(res.data);
      router.refresh();
    });
  }

  // The recipe big-swatch strip: prefer the resolved recipe-card palette;
  // fall back to the project's recipeSwatches (hex-only) when cards load.
  const palette =
    recipeCards && recipeCards.length > 0
      ? recipeCards[0].palette
      : project.recipeSwatches.map((hex) => ({ hex, label: "" }));

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {/* Breadcrumb back to the army. */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1 font-mono text-body text-cyan hover:underline"
          >
            ‹ {backLabel ?? "Back"}
          </button>
        )}

        {/* Header: title + UNIT / stage / priority pills. */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-fg-bright">
            {project.title}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            <PanelPill className="border-fg/40 text-fg-bright">{project.type.toUpperCase()}</PanelPill>
            <PanelPill className={cn(accentText[priorityAccent[project.priority]], "border-current/50")}>
              {project.priority.toUpperCase()}
            </PanelPill>
            <PanelPill className={cn(accentText[statusAccent[project.status]], "border-current/50")}>
              {STATUS_LABEL[project.status]}
            </PanelPill>
          </div>
        </div>

        {/* Full-bleed divider before RECIPE (44:21). */}
        <div className="-mx-4 mt-5 h-px bg-border md:-mx-6" aria-hidden />

        {/* RECIPE — five 60px named swatches (44:24). */}
        <h3 className="mt-5 label-osd text-fg-dim">Recipe</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          {palette.length > 0 ? (
            palette.slice(0, 5).map((p, i) => (
              <div key={`${p.hex}-${i}`} className="flex w-[60px] flex-col gap-1.5">
                <Swatch hex={p.hex} size="lg" className="h-[60px] w-[60px] rounded-[6px]" />
                {p.label && (
                  <span className="truncate font-mono text-[11px] text-fg-dim" title={p.label}>
                    {p.label}
                  </span>
                )}
              </div>
            ))
          ) : (
            <p className="font-mono text-body text-fg-dim">No recipe attached yet.</p>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="attach" size="sm" onClick={() => onAttachRecipe?.(project)}>
            + Attach ▾
          </Button>
          <Button variant="add" size="sm" onClick={() => onCreateRecipe?.(project)}>
            + Create
          </Button>
        </div>

        {/* Full-bleed divider before PROGRESS (44:46). */}
        <div className="-mx-4 mt-6 h-px bg-border md:-mx-6" aria-hidden />

        {/* PROGRESS · n MODELS — cumulative stage steppers, hairline-separated. */}
        <h3 className="mt-5 label-osd text-fg-dim">
          Progress · {total} model{total === 1 ? "" : "s"}
        </h3>
        <div className="mt-3 flex flex-col">
          {STAGE_ROWS.map((row, idx) => {
            const value = snap ? (snap[row.column] as number) : 0;
            return (
              <div
                key={row.stage}
                className={cn(
                  "flex items-center gap-3 py-3",
                  idx > 0 && "border-t border-border",
                )}
              >
                <span className="w-[78px] shrink-0 font-mono text-body text-fg-bright">{row.label}</span>
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    aria-label={`Decrease ${row.label}`}
                    disabled={!snap || pending || value <= 0}
                    onClick={() => step(row.stage, row.column, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-l-[6px] bg-cyan font-bold text-bg disabled:opacity-30"
                  >
                    –
                  </button>
                  <span className="min-w-[58px] px-2 text-center font-mono text-body tabular-nums text-fg-bright">
                    {value} / {total}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${row.label}`}
                    disabled={!snap || pending || value >= total}
                    onClick={() => step(row.stage, row.column, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-r-[6px] border border-cyan/50 font-bold text-cyan disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <ProgressBar
                    percent={total ? Math.round((value / total) * 100) : 0}
                    accent={row.accent}
                    showLabel={false}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* OVERALL — derived via the canonical progressPercent (rolls up to the
            army through the project's completionPercent). */}
        <div className="mt-5 flex items-center gap-3">
          <span className="w-[78px] shrink-0 label-osd text-fg-dim">Overall</span>
          <div className="min-w-0 flex-1">
            <ProgressBar
              percent={overall}
              accent={overall >= 100 ? "green" : "cyan"}
              showLabel={false}
            />
          </div>
          <span className="shrink-0 font-mono text-body font-bold tabular-nums text-cyan">{overall}%</span>
        </div>

        {error && <p className="mt-3 font-mono text-body text-red">▸ {error}</p>}

        {/* Expand affordance (spec — not in the 44:4 frame), kept subtle. */}
        {onExpand && (
          <button
            type="button"
            onClick={() => onExpand(project)}
            className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] text-fg-faint hover:text-cyan"
          >
            ⤢ Open full page
          </button>
        )}
      </div>

      {/* Sticky GO PAINT! footer. */}
      <div className="-mx-4 -mb-4 mt-4 border-t border-border md:-mx-6 md:-mb-6">
        <button
          type="button"
          onClick={() => onGoPaint?.(project)}
          className="flex w-full items-center justify-center gap-2 bg-cyan px-4 py-4 font-display text-button font-bold uppercase tracking-wide text-bg transition-colors hover:bg-cyan/85"
        >
          ▷ GO PAINT!
        </button>
      </div>
    </div>
  );
}

function PanelPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[6px] border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide",
        className,
      )}
    >
      {children}
    </span>
  );
}
