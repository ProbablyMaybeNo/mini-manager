"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ProgressBar, Swatch } from "@/components/kit";
import { createProject } from "@/lib/actions/projects";
import { rollupProjectMinutes } from "@/lib/projectTime";
import { formatMinutes, priorityAccent, accentText } from "@/lib/palette";
import { cn } from "@/lib/cn";
import type { Project, ProjectType } from "@/lib/types";

/** App type → DB projectTypes literal (createProject input). */
const TYPE_TO_DB: Record<ProjectType, "Army" | "Warband" | "Unit" | "Model" | "Terrain Piece"> = {
  Army: "Army",
  Warband: "Warband",
  Unit: "Unit",
  Model: "Model",
  Terrain: "Terrain Piece",
};

/**
 * Army panel (Figma 43:4) — the container roster shown when a project row is
 * opened. Header (name + ARMY pill, PAINTING · HIGH · time meta, overall bar),
 * the UNITS list (name + recipe swatch dots + mini bar + % + drill chevron),
 * a "+ Add unit" affordance, and a sticky GO PAINT · NEXT footer.
 *
 * Drilling a unit (the › chevron) fires onDrill so the host pushes the Unit
 * panel. Overall progress + the army's roll-up come straight from the project
 * tree (completionPercent is host-computed), so adding a unit / editing a
 * unit's counters re-renders this list with the new roll-up.
 */
export function ArmyPanelBody({
  project,
  projectMinutes = {},
  onDrill,
  onGoPaint,
  onExpand,
}: {
  project: Project;
  projectMinutes?: Record<string, number>;
  onDrill?: (unit: Project) => void;
  onGoPaint?: (project: Project, nextUnit: Project | null) => void;
  onExpand?: (project: Project) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const units = project.children ?? [];
  const minutes = rollupProjectMinutes(project, projectMinutes);
  const overall = project.completionPercent;

  // GO PAINT targets the first unit that isn't finished (NEXT: <unit>), or the
  // army itself if everything's done / there are no units.
  const nextUnit = units.find((u) => u.completionPercent < 100) ?? null;

  function addUnit() {
    setError(null);
    start(async () => {
      const res = await createProject({
        name: "New Unit",
        type: TYPE_TO_DB.Unit,
        parentId: project.id,
        count: 1,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data?.id) onDrill?.({ ...stubUnit(res.data.id) });
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {/* Header: name + ARMY pill. */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-fg-bright">
            {project.title}
          </h2>
          <span className="inline-flex shrink-0 items-center rounded-[6px] border border-cyan/60 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-cyan">
            {project.type.toUpperCase()}
          </span>
        </div>

        {/* Meta line: status · priority · time. */}
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-body text-fg-dim">
          <span className="uppercase">{project.status === "SHELVED" ? "ON HOLD" : "PAINTING"}</span>
          <span aria-hidden>·</span>
          <span className={cn("uppercase", accentText[priorityAccent[project.priority]])}>
            {project.priority}
          </span>
          {minutes > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>{formatMinutes(minutes)}</span>
            </>
          )}
        </p>

        {/* Overall progress bar + %. */}
        <div className="mt-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <ProgressBar percent={overall} accent={overall >= 100 ? "green" : "cyan"} showLabel={false} />
          </div>
          <span className="shrink-0 font-mono text-body font-bold tabular-nums text-cyan">{overall}%</span>
        </div>

        {/* UNITS (n) list. */}
        <h3 className="mt-6 label-osd text-fg-dim">Units ({units.length})</h3>
        {units.length > 0 ? (
          <ul className="mt-2 flex flex-col">
            {units.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onDrill?.(u)}
                  className="flex w-full items-center gap-3 border-b border-border py-3 text-left transition-colors hover:bg-cyan/5 focus:outline-none focus-visible:bg-cyan/10"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[15px] font-bold text-fg-bright">
                    {u.title}
                  </span>
                  {/* Recipe swatch dots (up to 3). */}
                  <span className="flex shrink-0 items-center gap-1">
                    {u.recipeSwatches.slice(0, 3).map((hex, i) => (
                      <Swatch key={`${hex}-${i}`} hex={hex} size="sm" className="rounded-[3px]" />
                    ))}
                  </span>
                  {/* Mini bar. */}
                  <span className="hidden w-24 shrink-0 sm:block">
                    <ProgressBar
                      percent={u.completionPercent}
                      accent={u.completionPercent >= 100 ? "green" : "cyan"}
                      showLabel={false}
                    />
                  </span>
                  <span
                    className={cn(
                      "w-10 shrink-0 text-right font-mono text-body tabular-nums",
                      u.completionPercent >= 100 ? "text-green" : "text-cyan",
                    )}
                  >
                    {u.completionPercent}%
                  </span>
                  <span aria-hidden className="shrink-0 text-fg-faint">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 font-mono text-body text-fg-dim">No units yet.</p>
        )}

        <Button variant="add" size="sm" className="mt-4" disabled={pending} onClick={addUnit}>
          + Add unit
        </Button>

        {error && <p className="mt-3 font-mono text-body text-red">▸ {error}</p>}

        {onExpand && (
          <button
            type="button"
            onClick={() => onExpand(project)}
            className="mt-5 inline-flex items-center gap-1.5 font-mono text-body text-fg-dim hover:text-cyan"
          >
            ⤢ Open full page
          </button>
        )}
      </div>

      {/* Sticky GO PAINT · NEXT footer. */}
      <div className="-mx-4 -mb-4 mt-4 border-t border-border md:-mx-6 md:-mb-6">
        <button
          type="button"
          onClick={() => onGoPaint?.(project, nextUnit)}
          className="flex w-full items-center justify-center gap-2 bg-cyan px-4 py-4 font-display text-button font-bold uppercase tracking-wide text-bg transition-colors hover:bg-cyan/85"
        >
          ▸ Go Paint
          {nextUnit && (
            <span className="font-normal opacity-80">· Next: {nextUnit.title}</span>
          )}
        </button>
      </div>
    </div>
  );
}

/** Minimal Project stub for a freshly created unit so onDrill can push it before
 *  the router refresh resolves the real row in the tree. */
function stubUnit(id: string): Project {
  return {
    id,
    title: "New Unit",
    type: "Unit",
    recipeSwatches: [],
    status: "BUILDING",
    priority: "Med",
    completionPercent: 0,
    modelCount: 1,
  };
}
