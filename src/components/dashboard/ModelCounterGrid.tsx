"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/kit";
import { loadProjectCounters, setCounter } from "@/lib/actions/counters";
import { updateProjectCount } from "@/lib/actions/projects";
import { progressPercent } from "@/lib/progress";
import { cn } from "@/lib/cn";
import type { CounterSnapshot, CounterStage } from "@/lib/counters/cascade";
import type { Project } from "@/lib/types";

/**
 * Per-model painting tracker for a LEAF project (a unit that *is* a set of
 * models, not a container of sub-projects). Set the total model count (N), then
 * step each cumulative stage (Built → Primed → Painted → Completed) against the
 * real `setCounter` backend (cascade-clamped completed ≤ painted ≤ primed ≤
 * built ≤ N); the OVERALL bar is the canonical `progressPercent`, so it rolls up
 * to the parent army's bar.
 *
 * Ported into ProjectWorkspaceBody when the standalone Army/Unit flow panel was
 * folded into the one inspector — this is the grid that used to live in the
 * unit flow body. Counters are loaded per-id (the display `Project` carries only
 * `modelCount`/`completionPercent`, not the raw cascade columns).
 */
const STAGE_ROWS: {
  label: string;
  stage: CounterStage;
  column: keyof CounterSnapshot;
  accent: "green" | "cyan";
}[] = [
  { label: "Built", stage: "build", column: "buildCount", accent: "green" },
  { label: "Primed", stage: "prime", column: "primeCount", accent: "green" },
  { label: "Painted", stage: "paint", column: "paintCount", accent: "cyan" },
  { label: "Completed", stage: "base", column: "baseCount", accent: "green" },
];

export function ModelCounterGrid({ project }: { project: Project }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [snap, setSnap] = useState<CounterSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSnap(null);
    loadProjectCounters(project.id)
      .then((s) => alive && setSnap(s))
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

  function setTotal(next: number) {
    if (next < 0 || next > 9999 || next === total) return;
    setError(null);
    start(async () => {
      const res = await updateProjectCount({ id: project.id, count: next });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // This grid has no separate "owned" control — the stages start at Built —
      // so a project's models count as owned the moment you count them. Sync
      // `owned` to the new total; without it `owned` stays 0 and the cascade
      // (count ≥ owned ≥ build ≥ …) clamps every stage stepper to 0.
      const ownedRes = await setCounter({ projectId: project.id, stage: "owned", value: next });
      const fresh =
        ownedRes.ok && ownedRes.data ? ownedRes.data : await loadProjectCounters(project.id);
      setSnap(fresh);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* MODELS — the total count (N). Editable here (updateProjectCount); the
          stage steppers below clamp to it. */}
      <div className="flex items-center gap-3">
        <span className="w-[78px] shrink-0 label-osd text-fg-dim">Models</span>
        <div className="flex items-center gap-1 tabular-nums">
          <button
            type="button"
            aria-label="Decrease model count"
            disabled={pending || total <= 0}
            onClick={() => setTotal(total - 1)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center border border-cyan/40 font-button text-button text-cyan hover:bg-cyan/10 disabled:opacity-30 md:min-h-8 md:min-w-8"
          >
            −
          </button>
          <span className="min-w-[3rem] text-center font-num2 text-num2 text-fg-bright">{total}</span>
          <button
            type="button"
            aria-label="Increase model count"
            disabled={pending || total >= 9999}
            onClick={() => setTotal(total + 1)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center border border-cyan/40 font-button text-button text-cyan hover:bg-cyan/10 disabled:opacity-30 md:min-h-8 md:min-w-8"
          >
            +
          </button>
        </div>
      </div>

      {/* Cumulative stage steppers — one per painting stage, hairline-separated. */}
      <div className="flex flex-col">
        {STAGE_ROWS.map((row, idx) => {
          const value = snap ? (snap[row.column] as number) : 0;
          return (
            <div
              key={row.stage}
              className={cn("flex flex-wrap items-center gap-3 py-3", idx > 0 && "border-t border-border")}
            >
              <span className="w-[78px] shrink-0 font-body text-body text-fg">{row.label}</span>
              <div className="flex shrink-0 items-center gap-1 tabular-nums">
                <button
                  type="button"
                  aria-label={`Decrease ${row.label}`}
                  disabled={!snap || pending || value <= 0}
                  onClick={() => step(row.stage, row.column, -1)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center border border-cyan/40 font-button text-button text-cyan hover:bg-cyan/10 disabled:opacity-30 md:min-h-8 md:min-w-8"
                >
                  −
                </button>
                <span className="min-w-[3.5rem] text-center font-num2 text-num2 text-fg">
                  {value} / {total}
                </span>
                <button
                  type="button"
                  aria-label={`Increase ${row.label}`}
                  disabled={!snap || pending || value >= total}
                  onClick={() => step(row.stage, row.column, 1)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center border border-cyan/40 font-button text-button text-cyan hover:bg-cyan/10 disabled:opacity-30 md:min-h-8 md:min-w-8"
                >
                  +
                </button>
              </div>
              <div className="min-w-[6rem] flex-1">
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

      {/* OVERALL — canonical progressPercent, so it matches the roster roll-up. */}
      <div className="flex items-center gap-3">
        <span className="w-[78px] shrink-0 label-osd text-fg-dim">Overall</span>
        <div className="min-w-0 flex-1">
          <ProgressBar percent={overall} accent={overall >= 100 ? "green" : "cyan"} showLabel={false} />
        </div>
        <span className="shrink-0 font-num2 text-num2 font-bold tabular-nums text-cyan">{overall}%</span>
      </div>

      {error && <p className="font-body text-body text-red">▸ {error}</p>}
    </div>
  );
}
