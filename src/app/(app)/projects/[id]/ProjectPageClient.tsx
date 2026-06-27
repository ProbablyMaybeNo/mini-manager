"use client";

import { useRouter } from "next/navigation";
import { Chip, ProgressBar } from "@/components/kit";
import { ProjectWorkspaceBody } from "@/components/dashboard/ProjectWorkspaceBody";
import { cn } from "@/lib/cn";
import { formatMinutes, projectTypeAccent } from "@/lib/palette";
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

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="label-osd-h2 text-cyan">{project.title}</h1>
            {/* Prominent TYPE badge — TypeChip's Chip, sized up (larger text +
                padding) so the project's kind is unmissable at the top. */}
            <Chip
              accent={accent}
              className="px-3 py-1 text-[0.8rem] tracking-[0.2em]"
            >
              {project.type.toUpperCase()}
            </Chip>
          </div>
        </header>

        {/* OVERALL PROGRESS — the headline bar + compact stat trio. */}
        <section
          aria-label="Overall progress"
          className="mb-6 border border-cyan/30 bg-bg-raised/30 p-4"
        >
          <ProgressBar
            percent={project.completionPercent}
            accent={project.completionPercent >= 100 ? "green" : "cyan"}
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <OverallStat glyph="#" label="total" value={project.modelCount ?? 0} />
            <span aria-hidden className="text-fg-faint">·</span>
            <OverallStat
              glyph="✓"
              label="complete"
              value={project.modelsComplete ?? 0}
              accent="green"
            />
            <span aria-hidden className="text-fg-faint">·</span>
            <OverallStat glyph="🕒" label="time" value={formatMinutes(loggedMinutes ?? 0)} />
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
    </div>
  );
}

/** One cell of the overall progress strip — glyph + value + tiny label. */
function OverallStat({
  glyph,
  label,
  value,
  accent,
}: {
  glyph: string;
  label: string;
  value: React.ReactNode;
  accent?: "green";
}) {
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span aria-hidden className={cn("shrink-0", accent === "green" ? "text-green" : "text-cyan")}>
        {glyph}
      </span>
      <span
        className={cn(
          "font-num2 text-num2 tabular-nums",
          accent === "green" ? "text-green" : "text-fg",
        )}
      >
        {value}
      </span>
      <span className="truncate label-osd text-fg-dim">{label}</span>
    </span>
  );
}
