"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Chip,
  FocusReticleIcon,
  PriorityTag,
  ProgressBar,
  StatusText,
  useToast,
} from "@/components/kit";
import {
  RecipePickerDialog,
  type RecipePickerOption,
} from "@/components/recipe/RecipePickerDialog";
import { attachRecipeToProject, createRecipe } from "@/lib/actions/recipes";
import { cn } from "@/lib/cn";
import {
  accentDot,
  formatMinutes,
  priorityAccent,
  projectTypeAccent,
} from "@/lib/palette";
import type { Hex, Project, ProjectStatus, ProjectType } from "@/lib/types";

/** Lightweight ancestor descriptor for the breadcrumb (PP-2). */
export interface ProjectCrumb {
  id: string;
  title: string;
  type: ProjectType;
}

/** Real per-project meta the dashboard view-model doesn't carry — used for the
 *  TIMELINE + DETAILS/NOTES accordions so they only ever show real data. */
export interface ProjectMeta {
  createdAtIso: string | null;
  deadlineIso: string | null;
  notes: string | null;
  tags: string[];
}

/** "Jan 12, 2026" style long date for the timeline / details strip. */
function longDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Walk the sub-project tree, tallying leaf rows by roster bucket for stats. */
function tallyStatuses(children: Project[]): Record<"complete" | "inProgress" | "planned" | "onHold", number> {
  const acc = { complete: 0, inProgress: 0, planned: 0, onHold: 0 };
  const visit = (list: Project[]) => {
    for (const c of list) {
      if (c.status === "COMPLETE") acc.complete += 1;
      else if (c.status === "SHELVED") acc.onHold += 1;
      else if (c.status === "WISHLIST" || c.status === "OWNED") acc.planned += 1;
      else acc.inProgress += 1;
      if (c.children) visit(c.children);
    }
  };
  visit(children);
  return acc;
}

/**
 * Full-page project workspace (Figma 13:4) — a read-first, roomy view of one
 * project: breadcrumb + title + START PAINTING, a PROGRESS card, the RECIPE
 * summary, the SUB-PROJECTS table (rows drill to their own page / focus), and
 * collapsed DETAILS / NOTES accordions. A 270px right rail carries the PROJECT
 * TIMELINE, RELATED links, and QUICK STATS. Editing a sub-project happens on
 * its own page or via the dashboard flow panel — this page is the overview.
 */
export function ProjectPageClient({
  project,
  ancestors = [],
  loggedMinutes,
  meta,
  recipeOptions = [],
}: {
  project: Project;
  ancestors?: ProjectCrumb[];
  loggedMinutes?: number;
  meta?: ProjectMeta;
  /** The user's recipes (recently-used first) for the attach dropdown. */
  recipeOptions?: RecipePickerOption[];
}) {
  const router = useRouter();
  const { toast, node: toastNode } = useToast();
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachPending, startAttach] = useTransition();

  // Attach an existing recipe to this project, then refresh in place so the
  // RECIPE card's swatches update without navigating away.
  function attach(recipeId: string) {
    setAttachOpen(false);
    const name = recipeOptions.find((r) => r.id === recipeId)?.name ?? "recipe";
    startAttach(async () => {
      const res = await attachRecipeToProject({ recipeId, projectId: project.id });
      if (res.ok) {
        toast(`Attached ${name}`, "green");
        router.refresh();
      } else {
        toast(res.error, "red");
      }
    });
  }

  // Create a NEW recipe already attached to this project, then open it in the
  // editor with a "‹ back to <project>" return.
  function createForProject() {
    setAttachOpen(false);
    startAttach(async () => {
      const res = await createRecipe({
        name: `${project.title} recipe`,
        attachedProjectId: project.id,
      });
      if (res.ok && res.data?.id) {
        router.push(`/recipes/${res.data.id}?from=${project.id}`);
      } else if (!res.ok) {
        toast(res.error, "red");
      }
    });
  }

  const accent = projectTypeAccent[project.type];
  const children = project.children ?? [];
  const childCount = children.length;

  // n / N container progress denominator. For an Army the Figma reads
  // "6 / 10 UNITS" — n = completed sub-projects, N = total sub-projects.
  const completedChildren = children.filter((c) => c.status === "COMPLETE").length;
  const unitNoun = project.type === "Army" || project.type === "Warband" ? "UNITS" : "SUB-PROJECTS";

  // RECIPE summary: the army's own swatches plus its children's, deduped, for
  // the big-square preview + the "N paint recipes attached" count.
  const recipeSwatches: Hex[] = Array.from(
    new Set([...project.recipeSwatches, ...children.flatMap((c) => c.recipeSwatches)]),
  );
  const recipeCount = children.filter((c) => c.recipeSwatches.length > 0).length
    + (project.recipeSwatches.length > 0 ? 1 : 0);

  const stats = tallyStatuses(children);
  const coloursUsed = recipeSwatches.length;

  const createdLong = longDate(meta?.createdAtIso ?? null);
  const deadlineLong = longDate(meta?.deadlineIso ?? null);

  return (
    <div className="flex h-full bg-bg">
      {/* Central column — scrolls independently of the right rail. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-8">
        {/* HEADER (13:44): ← breadcrumb, big title + TYPE pill, START PAINTING. */}
        <header className="flex flex-col gap-4">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-2 font-mono text-[12px] uppercase tracking-wide text-fg-dim"
          >
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              aria-label="Back to dashboard"
              className="inline-flex h-5 w-5 items-center justify-center text-fg hover:text-cyan"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="hover:text-cyan"
            >
              Projects
            </button>
            {ancestors.map((a) => (
              <span key={a.id} className="flex items-center gap-2">
                <span aria-hidden className="text-fg-faint">›</span>
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${a.id}`)}
                  className="hover:text-cyan"
                >
                  {a.title}
                </button>
              </span>
            ))}
            <span aria-hidden className="text-fg-faint">›</span>
            <span className="text-fg">{project.title}</span>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="font-mono text-[clamp(1.75rem,4vw,2.5rem)] font-bold uppercase leading-none tracking-tight text-fg-bright">
                {project.title}
              </h1>
              <Chip accent={accent} className="px-2.5 py-1 text-[12px] tracking-wide">
                {project.type.toUpperCase()}
              </Chip>
            </div>
            <Button variant="primary" onClick={() => router.push(`/focus?project=${project.id}`)}>
              START PAINTING
            </Button>
          </div>
        </header>

        <div className="mt-6 flex flex-col gap-6">
          {/* PROJECT PROGRESS card (13:60). */}
          <section
            aria-label="Project progress"
            className="flex flex-col gap-5 rounded-[12px] border border-border bg-surface p-6"
          >
            <h2 className="font-mono text-[12px] font-bold uppercase tracking-wide text-fg-bright">
              PROJECT PROGRESS
            </h2>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <ProgressBar
                  percent={project.completionPercent}
                  accent={project.completionPercent >= 100 ? "green" : "cyan"}
                  showLabel={false}
                />
              </div>
              <span className="shrink-0 font-mono text-[12px] font-bold tabular-nums text-cyan">
                {project.completionPercent}%
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-y-2">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {childCount > 0 && (
                  <span className="font-mono text-[13px] text-fg">
                    {completedChildren} / {childCount} {unitNoun}
                  </span>
                )}
                {childCount > 0 && <Divider />}
                <span className="font-mono text-[13px] text-fg">
                  {formatMinutes(loggedMinutes ?? 0)} LOGGED
                </span>
                <Divider />
                <span className="flex items-center gap-1.5 font-mono text-[12px] uppercase text-fg">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      accentDot[priorityAccent[project.priority]],
                    )}
                    aria-hidden
                  />
                  {project.priority} PRIORITY
                </span>
                <Divider />
                <StatusText status={project.status} />
              </div>
            </div>
          </section>

          {/* RECIPE summary (13:233) — label + count + big swatch preview, plus
              the ATTACH / CREATE affordances. When recipes are attached the card
              still opens the picker to add or change one; the empty state offers
              the two real paths (no dead /recipes link). */}
          <section
            aria-label="Attached recipes"
            className="flex flex-wrap items-center justify-between gap-4 rounded-[12px] border border-border bg-surface p-4"
          >
            <div className="flex min-w-0 items-center gap-4">
              <span className="shrink-0 font-mono text-[13px] font-bold uppercase text-fg-bright">
                RECIPE
              </span>
              <span className="shrink-0 font-mono text-[12px] text-fg-dim">
                {recipeCount > 0
                  ? `${recipeCount} PAINT RECIPE${recipeCount === 1 ? "" : "S"} ATTACHED`
                  : "NO RECIPES ATTACHED"}
              </span>
              {recipeSwatches.length > 0 && (
                <span className="flex shrink-0 items-center gap-1">
                  {recipeSwatches.slice(0, 3).map((hex, i) => (
                    <span
                      key={`${hex}-${i}`}
                      className="h-[100px] w-[100px] rounded-[2px]"
                      style={{ backgroundColor: hex }}
                      aria-hidden
                    />
                  ))}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="attach"
                size="sm"
                disabled={attachPending}
                onClick={() => setAttachOpen(true)}
              >
                {recipeCount > 0 ? "+ Attach ▾" : "+ Attach"}
              </Button>
              <Button
                variant="add"
                size="sm"
                disabled={attachPending}
                onClick={createForProject}
              >
                + Create
              </Button>
            </div>
          </section>

          {/* SUB-PROJECTS (13:79) — header + table + add-row. */}
          <section aria-label="Sub-projects" className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              {/* Count badge sits OUTSIDE the <h2> so the heading reads
                  "SUB-PROJECTS", not "SUB-PROJECTS0" (UX-008). */}
              <div className="flex items-center gap-3">
                <h2 className="font-mono text-[15px] font-bold uppercase tracking-wide text-fg-bright">
                  SUB-PROJECTS
                </h2>
                <span
                  aria-label={`${childCount} sub-project${childCount === 1 ? "" : "s"}`}
                  className="inline-flex items-center rounded-[4px] border border-border px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-fg-dim"
                >
                  {childCount}
                </span>
              </div>
              <Button
                variant="add"
                size="sm"
                onClick={() => router.push(`/dashboard?open=${project.id}`)}
              >
                + ADD UNIT
              </Button>
            </div>

            <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
              {childCount > 0 ? (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {["TITLE", "TYPE", "STATUS", "PRIORITY", "COMPLETION", "TIME", ""].map(
                        (c, i) => (
                          <th
                            key={c || `c${i}`}
                            scope="col"
                            className="px-4 py-3 text-left font-mono text-[11px] font-normal uppercase tracking-wide text-fg-dim"
                          >
                            {c}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((c) => (
                      <SubProjectRow
                        key={c.id}
                        child={c}
                        onOpen={() => router.push(`/projects/${c.id}`)}
                        onFocus={() => router.push(`/focus?project=${c.id}`)}
                      />
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-6 py-10 text-center font-mono text-[13px] text-fg-dim">
                  No sub-projects yet.
                </div>
              )}
              {/* + Add Sub-Project footer (13:225) — centred, hairline-topped. */}
              <button
                type="button"
                onClick={() => router.push(`/dashboard?open=${project.id}`)}
                className="flex w-full items-center justify-center border-t border-border px-4 py-4 font-mono text-[13px] text-cyan transition-colors hover:bg-cyan/5 focus:outline-none focus-visible:bg-cyan/10"
              >
                + Add Sub-Project
              </button>
            </div>
          </section>

          {/* DETAILS accordion header (13:228) — collapsed summary strip. */}
          <AccordionStrip
            label="DETAILS"
            summary={[
              createdLong ? `Created ${createdLong}` : null,
              deadlineLong ? `Deadline ${deadlineLong}` : null,
              meta?.tags.length ? `Tags: ${meta.tags.map((t) => `'${t}'`).join(" ")}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            onClick={() => router.push(`/dashboard?open=${project.id}`)}
          />

          {/* NOTES accordion header (13:243) — collapsed first-line preview. */}
          {meta?.notes && (
            <AccordionStrip
              label="NOTES"
              summary={`'${meta.notes.split("\n")[0].slice(0, 80)}${
                meta.notes.length > 80 ? "…" : ""
              }'`}
              onClick={() => router.push(`/dashboard?open=${project.id}`)}
            />
          )}
        </div>
      </div>

      {/* RIGHT RAIL (13:248) — TIMELINE + RELATED + QUICK STATS, flush right. */}
      <aside
        aria-label="Project details"
        className="hidden w-[270px] shrink-0 flex-col gap-8 overflow-y-auto border-l border-border bg-bg p-6 xl:flex"
      >
        {/* PROJECT TIMELINE — built from real dates + current status only. */}
        <section className="flex flex-col gap-5">
          <h2 className="font-mono text-[14px] font-bold uppercase text-cyan">PROJECT TIMELINE</h2>
          <ol className="flex flex-col">
            {createdLong && (
              <TimelineEntry title="Project Created" sub={createdLong} done last={false} />
            )}
            <TimelineEntry
              title={statusTimelineLabel(project.status)}
              sub="CURRENT"
              done
              current
              last={!deadlineLong}
            />
            {deadlineLong && (
              <TimelineEntry title="Deadline" sub={deadlineLong} done={false} last />
            )}
          </ol>
        </section>

        {ancestors.length > 0 && (
          <>
            <div className="h-px w-full bg-border" aria-hidden />
            <section className="flex flex-col gap-4">
              <h2 className="font-mono text-[14px] font-bold uppercase text-cyan">RELATED</h2>
              <div className="flex flex-col gap-3">
                {ancestors.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => router.push(`/projects/${a.id}`)}
                    className={cn(
                      "rounded-[8px] border bg-bg p-3 text-left font-mono text-[12px] transition-colors",
                      i === ancestors.length - 1
                        ? "border-cyan text-cyan hover:bg-cyan/10"
                        : "border-border text-fg-dim hover:border-cyan/40 hover:text-fg",
                    )}
                  >
                    {a.title} <span className="text-fg-dim">(parent)</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        <div className="h-px w-full bg-border" aria-hidden />

        {/* QUICK STATS (13:289) — label / colour-coded value rows. */}
        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-[14px] font-bold uppercase text-cyan">QUICK STATS</h2>
          <dl className="flex flex-col gap-2 font-mono text-[12px]">
            <StatRow label="Total Models" value={project.modelCount ?? 0} />
            <StatRow label="Completed" value={stats.complete} valueClass="text-green" />
            <StatRow label="In Progress" value={stats.inProgress} valueClass="text-cyan" />
            <StatRow label="Planned" value={stats.planned} valueClass="text-yellow" />
            <StatRow label="On Hold" value={stats.onHold} valueClass="text-purple" className="pt-2" />
            <StatRow label="Colours Used" value={coloursUsed} />
          </dl>
        </section>
      </aside>

      <RecipePickerDialog
        open={attachOpen}
        recipes={recipeOptions}
        busy={attachPending}
        title={`Attach a recipe to ${project.title}`}
        breadcrumb="PROJECT"
        createLabel="+ Create new"
        onPick={attach}
        onCreateNew={createForProject}
        onClose={() => setAttachOpen(false)}
      />
      {toastNode}
    </div>
  );
}

/** A thin vertical divider used between the progress-card meta items (13:69). */
function Divider() {
  return <span className="h-3 w-px shrink-0 bg-border" aria-hidden />;
}

/** Map a project status to its timeline milestone phrase. */
function statusTimelineLabel(status: ProjectStatus): string {
  switch (status) {
    case "COMPLETE":
      return "Completed";
    case "WISHLIST":
    case "OWNED":
      return "Planning";
    case "SHELVED":
      return "On hold";
    default:
      return "In progress";
  }
}

/** One SUB-PROJECTS table row (13:99) — drills on click; crosshair → focus,
 *  chevron → the sub-project's own page. */
function SubProjectRow({
  child,
  onOpen,
  onFocus,
}: {
  child: Project;
  onOpen: () => void;
  onFocus: () => void;
}) {
  return (
    <tr
      tabIndex={0}
      role="button"
      aria-label={`Open ${child.title}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-cyan/[0.06] focus:outline-none focus-visible:bg-cyan/10"
    >
      <td className="px-4 py-2.5 font-mono text-[13px] text-fg-bright">{child.title}</td>
      <td className="px-4 py-2.5 font-mono text-[13px] text-fg-dim">{child.type}</td>
      <td className="px-4 py-2.5">
        <StatusText status={child.status} />
      </td>
      <td className="px-4 py-2.5">
        <PriorityTag priority={child.priority} />
      </td>
      <td className="w-44 px-4 py-2.5">
        <ProgressBar
          percent={child.completionPercent}
          accent={child.completionPercent >= 100 ? "green" : "cyan"}
          showLabel={false}
        />
      </td>
      <td className="w-20 px-4 py-2.5 font-mono text-[13px] tabular-nums text-fg-dim">—</td>
      <td className="w-20 px-4 py-2.5">
        <div className="flex items-center justify-end gap-3 text-fg-dim">
          <button
            type="button"
            aria-label={`Focus ${child.title}`}
            title="Open in focus"
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
            }}
            className="inline-flex h-5 w-5 items-center justify-center hover:text-purple focus:outline-none focus-visible:text-purple"
          >
            <FocusReticleIcon size={16} />
          </button>
          <span aria-hidden className="text-fg-faint">›</span>
        </div>
      </td>
    </tr>
  );
}

/** Collapsed accordion header strip (13:228 / 13:243) — label + summary + ›. */
function AccordionStrip({
  label,
  summary,
  onClick,
}: {
  label: string;
  summary: string;
  onClick: () => void;
}) {
  if (!summary) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-4 rounded-[8px] border border-border bg-surface p-4 text-left transition-colors hover:border-cyan/40 focus:outline-none focus-visible:border-cyan"
    >
      <span className="flex min-w-0 items-center gap-4">
        <span className="shrink-0 font-mono text-[13px] font-bold uppercase text-fg-bright">
          {label}
        </span>
        <span className="min-w-0 truncate font-mono text-[12px] text-fg-dim">{summary}</span>
      </span>
      <span aria-hidden className="shrink-0 text-fg-dim">›</span>
    </button>
  );
}

/** One PROJECT TIMELINE entry (13:252) — dot + connector + 2-line block. */
function TimelineEntry({
  title,
  sub,
  done,
  current = false,
  last,
}: {
  title: string;
  sub: string;
  done: boolean;
  current?: boolean;
  last: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex w-2 flex-col items-center pt-0.5">
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            current ? "bg-cyan" : done ? "bg-green" : "border border-fg-faint bg-transparent",
          )}
          aria-hidden
        />
        {!last && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
      </div>
      <div className={cn("flex flex-col gap-0.5", last ? "pb-0" : "pb-4")}>
        <span className="font-mono text-[12px] font-bold text-fg-bright">{title}</span>
        <span className={cn("font-mono text-[11px]", current ? "text-cyan" : "text-fg-dim")}>
          {sub}
        </span>
      </div>
    </li>
  );
}

/** One QUICK STATS row (13:292) — label left, colour-coded value right. */
function StatRow({
  label,
  value,
  valueClass = "text-fg-bright",
  className,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <dt className="text-fg-dim">{label}</dt>
      <dd className={cn("tabular-nums", valueClass)}>{value}</dd>
    </div>
  );
}
