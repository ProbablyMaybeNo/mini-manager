"use client";

import { useRouter } from "next/navigation";
import { Button, Chip, ProgressBar, StatusText } from "@/components/kit";
import { ProjectWorkspaceBody } from "@/components/dashboard/ProjectWorkspaceBody";
import { cn } from "@/lib/cn";
import { formatMinutes, priorityAccent, projectTypeAccent, accentText } from "@/lib/palette";
import type { Project, ProjectType } from "@/lib/types";

/** Lightweight ancestor descriptor for the breadcrumb (PP-2). */
export interface ProjectCrumb {
  id: string;
  title: string;
  type: ProjectType;
}

/**
 * Full-page project workspace (PP-2) — sub-project-list-first. The page leads
 * with the header (back + breadcrumb + name + a prominent TYPE badge) and an
 * overall progress strip, then hands off to ProjectWorkspaceBody which renders
 * the SUB-PROJECTS list as the centerpiece followed by the secondary
 * DETAILS / RECIPES / INFO sections.
 */
export function ProjectPageClient({
  project,
  ancestors = [],
  loggedMinutes,
}: {
  project: Project;
  ancestors?: ProjectCrumb[];
  loggedMinutes?: number;
}) {
  const router = useRouter();
  const accent = projectTypeAccent[project.type];

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="mb-4 self-start label-osd text-fg hover:text-cyan"
      >
        ‹ Dashboard
      </button>

      <div className="mx-auto w-full max-w-6xl">
        {/* HEADER — breadcrumb by depth, name + prominent TYPE badge. */}
        <header className="mb-5">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1.5 label-osd tracking-[0.18em] text-fg-dim"
          >
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="uppercase hover:text-cyan"
            >
              Dashboard
            </button>
            {ancestors.map((a) => (
              <span key={a.id} className="flex items-center gap-1.5">
                <span aria-hidden className="text-fg-faint">▸</span>
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${a.id}`)}
                  className="uppercase hover:text-cyan"
                >
                  {a.title}
                </button>
              </span>
            ))}
            <span aria-hidden className="text-fg-faint">▸</span>
            <span className="uppercase text-fg">{project.title}</span>
          </nav>

          {/* Title row (13:4): big uppercase JBM-bold title + ARMY pill, with a
              START PAINTING primary button pushed to the right. */}
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="page-title text-[clamp(1.75rem,4vw,2.5rem)] leading-none text-fg-bright">
                {project.title}
              </h1>
              <Chip accent={accent} className="px-3 py-1 text-[0.8rem] tracking-[0.2em]">
                {project.type.toUpperCase()}
              </Chip>
            </div>
            <Button
              variant="primary"
              onClick={() => router.push(`/focus?project=${project.id}`)}
            >
              ▸ Start Painting
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-6 xl:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {/* PROJECT PROGRESS card (13:4): bar + % then a meta line —
                n/N units · time logged · priority · status pill. */}
            <section
              aria-label="Project progress"
              className="rounded-[12px] border border-border bg-surface p-5"
            >
              <h2 className="label-osd text-fg-dim">Project progress</h2>
              <div className="mt-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <ProgressBar
                    percent={project.completionPercent}
                    accent={project.completionPercent >= 100 ? "green" : "cyan"}
                    showLabel={false}
                  />
                </div>
                <span className="shrink-0 font-mono text-body font-bold tabular-nums text-cyan">
                  {project.completionPercent}%
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-body text-fg-dim">
                {(project.children?.length ?? 0) > 0 && (
                  <span>
                    {project.modelsComplete ?? 0} / {project.modelCount ?? 0} units
                  </span>
                )}
                <span aria-hidden className="text-fg-faint">·</span>
                <span>{formatMinutes(loggedMinutes ?? 0)} logged</span>
                <span aria-hidden className="text-fg-faint">·</span>
                <span className={cn("uppercase", accentText[priorityAccent[project.priority]])}>
                  ● {project.priority} priority
                </span>
                <span aria-hidden className="text-fg-faint">·</span>
                <StatusText status={project.status} />
              </div>
            </section>

            <ProjectWorkspaceBody
              project={project}
              loggedMinutes={loggedMinutes}
              variant="page"
              onStartSession={(p) => router.push(`/focus?project=${p.id}`)}
              onAttachRecipe={() => router.push("/recipes")}
              onOpenSubProject={(id) => router.push(`/projects/${id}`)}
              onClose={() => router.push("/dashboard")}
            />
          </div>

          {/* Right rail (13:4): QUICK STATS + RELATED, derived from the project
              tree + ancestors. TIMELINE is omitted (no event-history source). */}
          <aside className="flex shrink-0 flex-col gap-6 xl:w-[220px]">
            <section aria-label="Quick stats">
              <h2 className="label-osd-h2 text-cyan">Quick stats</h2>
              <dl className="mt-3 flex flex-col gap-2">
                <QuickStat label="Total models" value={project.modelCount ?? 0} />
                <QuickStat label="Completed" value={project.modelsComplete ?? 0} accent="green" />
                <QuickStat label="Sub-projects" value={project.children?.length ?? 0} />
                <QuickStat
                  label="Colours used"
                  value={new Set((project.children ?? []).flatMap((c) => c.recipeSwatches).concat(project.recipeSwatches)).size}
                />
              </dl>
            </section>

            {ancestors.length > 0 && (
              <section aria-label="Related">
                <h2 className="label-osd-h2 text-cyan">Related</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {ancestors.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => router.push(`/projects/${a.id}`)}
                      className="rounded-[6px] border border-cyan/40 px-3 py-2 text-left font-mono text-body text-cyan transition-colors hover:bg-cyan/10"
                    >
                      {a.title} <span className="text-fg-dim">(parent)</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/** One QUICK STATS row — label left, value right (13:4 right rail). */
function QuickStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: "green";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="font-mono text-body text-fg-dim">{label}</dt>
      <dd
        className={cn(
          "font-mono text-body font-bold tabular-nums",
          accent === "green" ? "text-green" : "text-fg-bright",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

