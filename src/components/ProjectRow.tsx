import Link from "next/link";
import type { Route } from "next";
import { clsx } from "clsx";
import type { Project, ProjectType } from "@/db/schema";
import { ProgressBar } from "./ProgressBar";
import { StageBarsStrip } from "./ui/StageBarsStrip";
import { displayStatus, progressPercent } from "@/lib/progress";
import { StatusPill, type StatusPillKind } from "./ui/StatusPill";

const STATUS_PILL: Record<
  ReturnType<typeof displayStatus>,
  StatusPillKind
> = {
  New: "info",
  Pile: "neutral",
  Assembling: "info",
  Priming: "info",
  Painting: "warning",
  Completed: "ok",
  Shelved: "neutral",
};

const PRIORITY_TONE: Record<NonNullable<Project["priority"]>, string> = {
  Urgent: "bg-[var(--color-red)]",
  High: "bg-[var(--color-amber)]",
  Medium: "bg-[var(--color-cyan-dim)]",
  Low: "bg-[var(--color-fg-subtle)]",
};

/**
 * Per-type chip palette. Maps the 6 project types to a colour from
 * the locked 5-color set so the kind of project reads at a glance
 * without needing to scan the text label. Army-shaped containers
 * (Army / Warband) sit on cyan ("primary scope"); per-model work
 * (Unit) on amber/yellow; standalone-one-offs (Single Model /
 * Diorama) on pastel purple ("special / featured"); environmental
 * (Terrain Piece) on neon green. P11.5.
 */
const TYPE_CHIP: Readonly<Record<ProjectType, string>> = {
  "Army":          "type-chip-cyan",
  "Warband":       "type-chip-cyan",
  "Unit":          "type-chip-amber",
  "Single Model":  "type-chip-purple",
  "Terrain Piece": "type-chip-green",
  "Diorama":       "type-chip-purple",
};

export function ProjectRow({
  project,
  namedModelCount = 0,
  href,
}: {
  project: Project;
  namedModelCount?: number;
  href?: string;
}) {
  const totalModels = project.count + namedModelCount;
  const status = displayStatus(project);
  const percent = progressPercent(project);
  const priorityClass = project.priority
    ? PRIORITY_TONE[project.priority]
    : "bg-transparent";

  const linkHref = (href ?? `/projects/${project.id}`) as Route;
  const typeChipClass = TYPE_CHIP[project.type as ProjectType];

  return (
    <Link
      href={linkHref}
      className="caret-row group grid grid-cols-[4px_1fr_auto_auto] lg:grid-cols-[4px_1fr_auto_auto_auto_auto] items-center gap-3 px-3 py-2.5 border-b border-[var(--color-border)] hover:bg-[color-mix(in_srgb,var(--color-fg)_3%,transparent)] min-h-[44px] md:min-h-[36px]"
    >
      <span
        className={clsx("h-6 w-1 rounded-sm flex-shrink-0", priorityClass)}
        aria-label={project.priority ? `${project.priority} priority` : undefined}
      />
      <span className="min-w-0 flex-1" title={project.name}>
        <span className="block text-sm font-mono truncate group-hover:text-[var(--color-accent)]">
          {project.name}
        </span>
        {project.faction ? (
          <span
            className={clsx(
              "type-chip type-chip-purple-muted mt-0.5",
              "max-w-full truncate",
            )}
            title={project.faction}
          >
            {project.faction}
          </span>
        ) : null}
      </span>
      <span className="hidden lg:inline-block">
        <span className={clsx("type-chip", typeChipClass)}>
          {project.type}
        </span>
      </span>
      <span className="hidden lg:inline-block">
        <StageBarsStrip
          counts={{
            buildCount: project.buildCount,
            primeCount: project.primeCount,
            paintCount: project.paintCount,
            baseCount: project.baseCount,
            completeCount: project.completeCount,
            total: project.count,
          }}
        />
      </span>
      <span className="hidden lg:inline-block">
        <ProgressBar percent={percent} width={14} />
      </span>
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        {status === "New" ? (
          <StatusPill status="neutral">NEW</StatusPill>
        ) : (
          <StatusPill status={STATUS_PILL[status]}>{status}</StatusPill>
        )}
        {totalModels > 0 ? (
          <span className="text-2xs font-mono text-[var(--color-fg-muted)]">
            {percent}%
          </span>
        ) : null}
      </span>
    </Link>
  );
}
