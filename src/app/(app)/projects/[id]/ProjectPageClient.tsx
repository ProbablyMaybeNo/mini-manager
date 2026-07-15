"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Chip,
  DateField,
  FocusReticleIcon,
  Listbox,
  PriorityTag,
  ProgressBar,
  StatusText,
  useToast,
} from "@/components/kit";
import {
  RecipePickerDialog,
  type RecipePickerOption,
} from "@/components/recipe/RecipePickerDialog";
import { ProjectImagePanel } from "@/components/dashboard/ProjectImagePanel";
import { attachRecipeToProject, createRecipe } from "@/lib/actions/recipes";
import {
  bumpProjectStatus,
  updateProjectPriority,
  updateProjectType,
} from "@/lib/actions/projects";
import {
  setProjectTargetDate,
  updateProjectNotes,
} from "@/lib/actions/projectMeta";
import { cn } from "@/lib/cn";
import {
  accentDot,
  formatMinutes,
  priorityAccent,
  projectTypeAccent,
  statusAccent,
  STATUS_LABEL,
} from "@/lib/palette";
import type { Hex, Priority, Project, ProjectStatus, ProjectType } from "@/lib/types";

const STATUS_OPTIONS: ProjectStatus[] = [
  "WISHLIST",
  "OWNED",
  "BUILDING",
  "PRIMING",
  "PAINTING",
  "BASING",
  "COMPLETE",
  "SHELVED",
];
const PRIORITY_OPTIONS: Priority[] = ["Low", "Med", "High"];
const TYPE_OPTIONS: ProjectType[] = ["Army", "Warband", "Unit", "Model", "Terrain"];

/** App display priority → DB priority enum. Mirrors ProjectWorkspaceBody. */
const PRIORITY_TO_DB: Record<Priority, "Low" | "Medium" | "High"> = {
  Low: "Low",
  Med: "Medium",
  High: "High",
};
/** App type → DB projectTypes literal. Mirrors ProjectWorkspaceBody. */
const TYPE_TO_DB: Record<ProjectType, "Army" | "Warband" | "Unit" | "Model" | "Terrain Piece"> = {
  Army: "Army",
  Warband: "Warband",
  Unit: "Unit",
  Model: "Model",
  Terrain: "Terrain Piece",
};

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
  initialHasPhotos = false,
}: {
  project: Project;
  ancestors?: ProjectCrumb[];
  loggedMinutes?: number;
  meta?: ProjectMeta;
  /** The user's recipes (recently-used first) for the attach dropdown. */
  recipeOptions?: RecipePickerOption[];
  /** Server-seeded: does this project already have ≥1 uploaded photo? Drives
   *  whether the right-hand photo column mounts on first paint. */
  initialHasPhotos?: boolean;
}) {
  const router = useRouter();
  const { toast, node: toastNode } = useToast();
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachPending, startAttach] = useTransition();
  // Show the photo column only once a photo exists (Ross) — otherwise the page
  // reads left-heavy with an empty column. The inline PHOTOS block (below the
  // editable details) carries the UPLOAD affordance until then; adding the first
  // photo flips this true and the column appears.
  const [hasPhotos, setHasPhotos] = useState(initialHasPhotos);

  // Attach an existing recipe to this project, then refresh in place so the
  // RECIPE card's swatches update without navigating away.
  function attach(recipeId: string) {
    setAttachOpen(false);
    const name = recipeOptions.find((r) => r.id === recipeId)?.name ?? "recipe";
    startAttach(async () => {
      const res = await attachRecipeToProject({ recipeId, projectId: project.id });
      if (res.ok) {
        // No router.refresh(): the force-dynamic page re-renders on the
        // server-action POST, updating the RECIPE swatches in place (P2).
        toast(`Attached ${name}`, "green");
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
              aria-label="Back to projects"
              className="inline-flex h-6 w-6 items-center justify-center text-fg hover:text-cyan-lite"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="hover:text-cyan-lite"
            >
              Projects
            </button>
            {ancestors.map((a) => (
              <span key={a.id} className="flex items-center gap-2">
                <span aria-hidden className="text-fg-faint">›</span>
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${a.id}`)}
                  className="hover:text-cyan-lite"
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
              <h1 className="font-title text-[clamp(0.84rem,2.06vw,1.3125rem)] font-extrabold uppercase leading-none tracking-[0.15em] text-fg-bright">
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
              <span className="shrink-0 font-mono text-[12px] font-bold tabular-nums text-cyan-lite">
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
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
              <span className="shrink-0 font-mono text-[13px] font-bold uppercase text-fg-bright">
                RECIPE
              </span>
              <span className="shrink-0 font-mono text-[12px] text-fg-dim">
                {recipeCount > 0
                  ? `${recipeCount} PAINT RECIPE${recipeCount === 1 ? "" : "S"} ATTACHED`
                  : "NO RECIPES ATTACHED"}
              </span>
              {recipeSwatches.length > 0 && (
                // Responsive swatch size (MUX-005): three 100px squares overran
                // the column on phones and forced horizontal page scroll. Shrink
                // on small screens; the row also wraps now so it never overflows.
                <span className="flex shrink-0 items-center gap-1">
                  {recipeSwatches.slice(0, 3).map((hex, i) => (
                    <span
                      key={`${hex}-${i}`}
                      className="h-12 w-12 rounded-[2px] sm:h-16 sm:w-16 lg:h-[100px] lg:w-[100px]"
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
                // Horizontal-scroll wrapper (MUX-002): below ~560px the columns
                // no longer fit; scroll rather than silently clipping the right
                // half (PRIORITY / actions) off-screen with no cue.
                <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
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
                </div>
              ) : (
                <div className="px-6 py-10 text-center font-mono text-[13px] text-fg-dim">
                  No sub-projects yet.
                </div>
              )}
              {/* + Add Sub-Project footer (13:225) — centred, hairline-topped. */}
              <button
                type="button"
                onClick={() => router.push(`/dashboard?open=${project.id}`)}
                className="flex w-full items-center justify-center border-t border-border px-4 py-4 font-mono text-[13px] text-cyan-lite transition-colors hover:bg-cyan/5 focus:outline-none focus-visible:bg-cyan/10"
              >
                + Add Sub-Project
              </button>
            </div>
          </section>

          {/* DETAILS — now editable inline (project-view overhaul): full parity
              with the dashboard panel so you can set type / status / priority /
              target date / notes right here, instead of the old collapsed
              accordions that just bounced you to `/dashboard?open=`. */}
          <EditableDetails project={project} meta={meta} />

          {/* No photos yet → the PHOTOS panel lives inline here (with its UPLOAD
              button) instead of reserving an empty right column. Uploading the
              first photo flips hasPhotos and it moves out to the column. */}
          {!hasPhotos && (
            <section
              aria-label="Model photos"
              className="flex flex-col gap-4 rounded-[12px] border border-border bg-surface p-6"
            >
              <h2 className="font-mono text-[15px] font-bold uppercase tracking-wide text-cyan-lite">
                PHOTOS
              </h2>
              <ProjectImagePanel projectId={project.id} onHasPhotosChange={setHasPhotos} />
            </section>
          )}
        </div>
      </div>

      {/* IMAGE COLUMN (project-view overhaul) — a full-height model-photo column
          sitting between the central sections and the right timeline rail, so the
          finished-model photos live on the page too (not just the panel). Only
          mounts once the project has a photo (else the inline block above carries
          it). Shows from lg (the rail only appears at xl), giving a graceful
          2-then-3 column build-up. */}
      {hasPhotos && (
        <aside
          aria-label="Model photos"
          className="hidden w-[320px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-bg p-6 lg:flex"
        >
          <h2 className="font-mono text-[14px] font-bold uppercase text-cyan-lite">PHOTOS</h2>
          <ProjectImagePanel projectId={project.id} onHasPhotosChange={setHasPhotos} />
        </aside>
      )}

      {/* RIGHT RAIL (13:248) — TIMELINE + RELATED + QUICK STATS, flush right. */}
      <aside
        aria-label="Project details"
        className="hidden w-[270px] shrink-0 flex-col gap-8 overflow-y-auto border-l border-border bg-bg p-6 xl:flex"
      >
        {/* PROJECT TIMELINE — built from real dates + current status only. */}
        <section className="flex flex-col gap-5">
          <h2 className="font-mono text-[14px] font-bold uppercase text-cyan-lite">PROJECT TIMELINE</h2>
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
              <h2 className="font-mono text-[14px] font-bold uppercase text-cyan-lite">RELATED</h2>
              <div className="flex flex-col gap-3">
                {ancestors.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => router.push(`/projects/${a.id}`)}
                    className={cn(
                      "rounded-[8px] border bg-bg p-3 text-left font-mono text-[12px] transition-colors",
                      i === ancestors.length - 1
                        ? "border-cyan text-cyan-lite hover:bg-cyan/10"
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
          <h2 className="font-mono text-[14px] font-bold uppercase text-cyan-lite">QUICK STATS</h2>
          <dl className="flex flex-col gap-2 font-mono text-[12px]">
            <StatRow label="Total Models" value={project.modelCount ?? 0} />
            <StatRow label="Completed" value={stats.complete} valueClass="text-green" />
            <StatRow label="In Progress" value={stats.inProgress} valueClass="text-cyan-lite" />
            <StatRow label="Planned" value={stats.planned} valueClass="text-yellow" />
            <StatRow label="On Hold" value={stats.onHold} valueClass="text-fg-muted" className="pt-2" />
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
            className="inline-flex h-6 w-6 items-center justify-center hover:text-purple focus:outline-none focus-visible:text-purple"
          >
            <FocusReticleIcon size={16} />
          </button>
          <span aria-hidden className="text-fg-faint">›</span>
        </div>
      </td>
    </tr>
  );
}

/**
 * Editable DETAILS section on the full project page (project-view overhaul) —
 * brings the full page to parity with the dashboard panel: type / status /
 * priority dropdowns, a target date, and a notes textarea, all writing straight
 * through the same server actions the panel uses. Replaces the old read-only
 * DETAILS / NOTES accordion strips that just deep-linked to the dashboard.
 */
function EditableDetails({ project, meta }: { project: Project; meta?: ProjectMeta }) {
  const [, start] = useTransition();
  // Optimistic Type/Status/Priority — paints the pick synchronously, then
  // resets to the fresh prop once the force-dynamic page re-renders from the
  // server-action POST (P1). No router.refresh() (P2).
  const [optimisticProject, applyOptimistic] = useOptimistic(
    project,
    (state: Project, patch: Partial<Project>) => ({ ...state, ...patch }),
  );
  const [notes, setNotes] = useState(meta?.notes ?? "");
  const [targetDate, setTargetDate] = useState(meta?.deadlineIso ?? "");

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    optimistic?: Partial<Project>,
  ) {
    start(async () => {
      if (optimistic) applyOptimistic(optimistic);
      await action();
    });
  }

  return (
    <section
      aria-label="Edit details"
      className="flex flex-col gap-4 rounded-[12px] border border-border bg-surface p-6"
    >
      <h2 className="font-mono text-[15px] font-bold uppercase tracking-wide text-cyan-lite">
        DETAILS
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="label-osd text-fg-dim">Type</span>
          <Listbox
            value={optimisticProject.type}
            ariaLabel="Project type"
            options={TYPE_OPTIONS.map((t) => ({ value: t, label: t.toUpperCase() }))}
            onChange={(t) =>
              run(() => updateProjectType({ id: project.id, type: TYPE_TO_DB[t] }), { type: t })
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-osd text-fg-dim">Status</span>
          <Listbox
            value={optimisticProject.status}
            ariaLabel="Project status"
            accent={statusAccent[optimisticProject.status]}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            onChange={(s) =>
              run(() => bumpProjectStatus({ id: project.id, status: s }), { status: s })
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-osd text-fg-dim">Priority</span>
          <Listbox
            value={optimisticProject.priority}
            ariaLabel="Project priority"
            accent={priorityAccent[optimisticProject.priority]}
            options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: p.toUpperCase() }))}
            onChange={(p) =>
              run(
                () => updateProjectPriority({ id: project.id, priority: PRIORITY_TO_DB[p] }),
                { priority: p },
              )
            }
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <span className="label-osd text-fg-dim">Target date</span>
        <DateField
          value={targetDate}
          ariaLabel="Target date"
          onChange={(v) => {
            setTargetDate(v);
            run(() => setProjectTargetDate({ id: project.id, date: v || null }));
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="label-osd text-fg-dim">Notes &amp; techniques</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => run(() => updateProjectNotes({ id: project.id, notes }))}
          rows={4}
          aria-label="Notes & techniques"
          placeholder="Notes & techniques — e.g. edge highlight Terminators with Stormhost Silver…"
          className="w-full resize-y border border-cyan/40 bg-bg px-3 py-2 font-body text-body text-fg focus:border-cyan focus:outline-none"
        />
      </div>
    </section>
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
        <span className={cn("font-mono text-[11px]", current ? "text-cyan-lite" : "text-fg-dim")}>
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
