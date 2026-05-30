import Link from "next/link";
import type { Route } from "next";
import { clsx } from "clsx";
import type { Project } from "@/db/schema";
import { ProgressBar } from "@/components/ProgressBar";
import { displayStatus, progressPercent } from "@/lib/progress";

/**
 * Compact server-rendered tree of direct child projects for an
 * Army / Warband workspace. One row per child — name, type, status,
 * and a small bar. Clicking navigates into the child's own workspace
 * (which renders its own tree at the next level, capped at 3 by the
 * application-layer nesting rule).
 *
 * Empty state is handled inline so the Army workspace can always
 * render the panel and surface "no children yet" guidance.
 */
export function ProjectTree({
  projects,
  namedModelCountByProjectId = {},
}: {
  projects: ReadonlyArray<Project>;
  namedModelCountByProjectId?: Record<string, number>;
}) {
  if (projects.length === 0) {
    return (
      <div className="frame p-4 text-xs font-mono text-[var(--color-fg-muted)]">
        No sub-projects yet. Add a Unit or Single Model and pick this
        project as its parent to see it here.
      </div>
    );
  }

  return (
    <ul className="frame divide-y divide-[var(--color-border)]" role="list">
      {projects.map((child) => (
        <ProjectTreeRow
          key={child.id}
          project={child}
          namedModelCount={namedModelCountByProjectId[child.id] ?? 0}
        />
      ))}
    </ul>
  );
}

function ProjectTreeRow({
  project,
  namedModelCount,
}: {
  project: Project;
  namedModelCount: number;
}) {
  const status = displayStatus(project);
  const percent = progressPercent(project);
  const href = `/projects/${project.id}` as Route;
  const total = project.count + namedModelCount;

  return (
    <li>
      <Link
        href={href}
        className={clsx(
          "group flex items-center gap-3 px-3 py-2 min-h-[36px] w-full",
          "hover:bg-[color-mix(in_srgb,var(--color-fg)_3%,transparent)]",
        )}
      >
        <span
          aria-hidden
          className="font-mono text-xs text-[var(--color-fg-subtle)] group-hover:text-[var(--color-green)] flex-shrink-0"
        >
          ▸
        </span>
        <span className="min-w-0 flex-1" title={project.name}>
          <span className="block text-sm font-mono truncate group-hover:text-[var(--color-green)]">
            {project.name}
          </span>
          <span className="block text-2xs font-mono text-[var(--color-fg-subtle)] uppercase tracking-wider">
            {project.type}
            {total > 0 ? ` · ${total} model${total === 1 ? "" : "s"}` : ""}
          </span>
        </span>
        <ProgressBar percent={percent} width={11} className="hidden md:inline" />
        <span className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider whitespace-nowrap flex-shrink-0">
          {status === "Empty" ? "—" : status} · {percent}%
        </span>
      </Link>
    </li>
  );
}
