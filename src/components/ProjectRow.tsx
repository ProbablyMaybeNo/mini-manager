import Link from "next/link";
import type { Route } from "next";
import { clsx } from "clsx";
import type { Project } from "@/db/schema";
import { PaletteStrip } from "./PaletteStrip";
import { RecipePaletteStripStatic } from "./recipes/RecipePaletteStrip";
import { ProgressBar } from "./ProgressBar";
import { displayStatus, progressPercent } from "@/lib/progress";

const STATUS_TONE: Record<ReturnType<typeof displayStatus>, string> = {
  Empty: "text-[var(--color-fg-subtle)]",
  Pile: "text-[var(--color-amber)]",
  Assembling: "text-[var(--color-cyan)]",
  Priming: "text-[var(--color-cyan)]",
  Painting: "text-[var(--color-green)]",
  Completed: "text-[var(--color-green)] glow-green",
  Shelved: "text-[var(--color-fg-subtle)]",
};

const PRIORITY_TONE: Record<NonNullable<Project["priority"]>, string> = {
  Urgent: "bg-[var(--color-red)]",
  High: "bg-[var(--color-amber)]",
  Medium: "bg-[var(--color-cyan-dim)]",
  Low: "bg-[var(--color-fg-subtle)]",
};

export function ProjectRow({
  project,
  namedModelCount = 0,
  href,
  recipeSwatches,
}: {
  project: Project;
  namedModelCount?: number;
  href?: string;
  /** Pre-resolved swatch hexes from the parent's bulk palette query.
   *  When non-empty, displaces the placeholder PaletteStrip. */
  recipeSwatches?: ReadonlyArray<string>;
}) {
  const totalModels = project.count + namedModelCount;
  const status = displayStatus(project);
  const percent = progressPercent(project);
  const priorityClass = project.priority
    ? PRIORITY_TONE[project.priority]
    : "bg-transparent";

  const linkHref = (href ?? `/projects/${project.id}`) as Route;

  return (
    <Link
      href={linkHref}
      className="group grid grid-cols-[4px_1fr_auto_auto_auto] md:grid-cols-[4px_2fr_auto_auto_120px_auto] items-center gap-3 px-3 py-2.5 border-b border-[var(--color-border)] hover:bg-[color-mix(in_srgb,var(--color-fg)_3%,transparent)] min-h-[44px] md:min-h-[36px]"
    >
      <span
        className={clsx("h-6 w-1 rounded-sm", priorityClass)}
        aria-label={project.priority ? `${project.priority} priority` : undefined}
      />
      <span className="min-w-0">
        <span className="block text-sm font-mono truncate group-hover:text-[var(--color-green)]">
          {project.name}
        </span>
        {project.faction ? (
          <span className="block text-2xs font-mono text-[var(--color-fg-subtle)] truncate">
            {project.faction}
          </span>
        ) : null}
      </span>
      <span className="hidden md:inline-block text-xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wide">
        {project.type}
      </span>
      <span className="hidden md:inline-block">
        {recipeSwatches && recipeSwatches.length > 0 ? (
          <RecipePaletteStripStatic
            swatches={recipeSwatches.slice(0, 5)}
            ariaLabel={`${project.name} palette`}
          />
        ) : (
          <PaletteStrip slots={5} />
        )}
      </span>
      <span className="hidden md:inline-block">
        <ProgressBar percent={percent} width={14} />
      </span>
      <span
        className={clsx(
          "text-xs font-mono uppercase tracking-wide whitespace-nowrap",
          STATUS_TONE[status],
        )}
      >
        {status === "Empty" ? "—" : status} {totalModels > 0 ? `· ${percent}%` : ""}
      </span>
    </Link>
  );
}
