"use client";

import { Button, Panel, ProgressBar, StatusText, SwatchStrip, TypeChip } from "@/components/kit";
import { formatMinutes } from "@/lib/palette";
import type { Project, ProjectStatus } from "@/lib/types";

/** The active build-lifecycle statuses — a project mid-paint is one the painter
 *  can "continue". Wishlist/owned (not started) and complete/shelved (done /
 *  parked) are deliberately excluded. */
const IN_PROGRESS: ReadonlySet<ProjectStatus> = new Set([
  "BUILDING",
  "PRIMING",
  "PAINTING",
  "BASING",
]);

const PRIORITY_RANK: Record<Project["priority"], number> = { High: 0, Med: 1, Low: 2 };

/** Flatten the project tree to a single list (rows + their sub-projects). */
function flatten(list: Project[], out: Project[] = []): Project[] {
  for (const p of list) {
    out.push(p);
    if (p.children?.length) flatten(p.children, out);
  }
  return out;
}

/**
 * DOP-003 — the "CONTINUE PAINTING" tier that fills the dashboard's empty lower
 * half. Surfaces the projects that are actually mid-paint so the painter can
 * jump straight back in (the single most-repeated intent on open). Pure display
 * over data already on the page — no new fetch. Renders nothing when nothing is
 * in progress, so the dashboard stays clean for a brand-new account.
 */
export function ContinuePainting({
  projects,
  projectMinutes = {},
  onResume,
  onOpenProject,
  limit = 6,
}: {
  projects: Project[];
  projectMinutes?: Record<string, number>;
  /** Start a focus session on the chosen project (the primary "continue" verb). */
  onResume?: (project: Project) => void;
  /** Open the project's inspector (secondary). */
  onOpenProject?: (project: Project) => void;
  limit?: number;
}) {
  const active = flatten(projects)
    .filter((p) => IN_PROGRESS.has(p.status))
    // Most actionable first: priority, then the closest-to-done (so a 90% model
    // surfaces above a freshly-primed one), then most time already invested.
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.completionPercent - a.completionPercent ||
        (projectMinutes[b.id] ?? 0) - (projectMinutes[a.id] ?? 0),
    )
    .slice(0, limit);

  if (active.length === 0) return null;

  return (
    <Panel label="CONTINUE PAINTING" cornerTicks className="p-4">
      <p className="mb-3 font-body text-body text-fg-dim">
        // pick up where you left off — {active.length} in progress
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 @3xl:grid-cols-3">
        {active.map((p) => {
          const minutes = projectMinutes[p.id] ?? 0;
          return (
            <div
              key={p.id}
              className="flex flex-col gap-2 border border-cyan/20 bg-bg-raised/30 p-3 transition-colors hover:border-cyan/50"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpenProject?.(p)}
                  className="min-w-0 flex-1 text-left font-body text-body font-medium text-fg hover:text-cyan"
                >
                  <span className="block truncate">{p.title}</span>
                </button>
                <TypeChip type={p.type} />
              </div>

              <div className="flex items-center gap-2">
                <StatusText status={p.status} />
                {minutes > 0 && (
                  <span className="ml-auto label-osd text-fg-faint">
                    {formatMinutes(minutes)} logged
                  </span>
                )}
              </div>

              <ProgressBar percent={p.completionPercent} />

              {p.recipeSwatches.length > 0 && (
                <SwatchStrip swatches={p.recipeSwatches} />
              )}

              <div className="mt-1 flex gap-2">
                <Button variant="add" size="sm" onClick={() => onResume?.(p)}>
                  ◎ Resume
                </Button>
                <Button variant="tertiary" size="sm" onClick={() => onOpenProject?.(p)}>
                  Open
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
