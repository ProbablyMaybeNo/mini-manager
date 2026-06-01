import Link from "next/link";
import type { Route } from "next";
import { clsx } from "clsx";
import type { Project } from "@/db/schema";
import { ProgressBar } from "@/components/ProgressBar";
import { displayStatus, progressPercent } from "@/lib/progress";

/**
 * Compact server-rendered tree of direct child projects for an
 * Army / Warband / Unit workspace. One row per child — name, type,
 * status, and a small bar. Clicking navigates into the child's own
 * workspace.
 *
 * P13.4 — child projects are always Unit-typed (sub-project type
 * rule). The empty-state copy reflects the new restriction.
 */
export function ProjectTree({
  projects,
}: {
  projects: ReadonlyArray<Project>;
}) {
  if (projects.length === 0) {
    return (
      <div className="frame p-4 text-xs font-mono text-[var(--color-fg-muted)]">
        No sub-projects yet. Add a Unit and pick this project as its
        parent to see it here.
      </div>
    );
  }

  return (
    <ul className="frame divide-y divide-[var(--color-border)]" role="list">
      {projects.map((child) => (
        <ProjectTreeRow key={child.id} project={child} />
      ))}
    </ul>
  );
}

function ProjectTreeRow({ project }: { project: Project }) {
  const status = displayStatus(project);
  const percent = progressPercent(project);
  const href = `/projects/${project.id}` as Route;
  const total = project.count;

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
          className="font-mono text-xs text-[var(--color-fg-subtle)] group-hover:text-[var(--color-accent)] flex-shrink-0"
        >
          ▸
        </span>
        <span className="min-w-0 flex-1" title={project.name}>
          <span className="block text-sm font-mono truncate group-hover:text-[var(--color-accent)]">
            {project.name}
          </span>
          <span className="block text-2xs font-mono text-[var(--color-fg-subtle)] uppercase tracking-wider">
            {project.type}
            {total > 0 ? ` · ${total} model${total === 1 ? "" : "s"}` : ""}
          </span>
        </span>
        <ProgressBar percent={percent} width={11} className="hidden md:inline" />
        <span className="text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider whitespace-nowrap flex-shrink-0">
          {status === "WISHLIST" && project.count === 0 ? "—" : status} · {percent}%
        </span>
      </Link>
    </li>
  );
}
