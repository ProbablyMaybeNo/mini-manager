"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  ConfirmDialog,
  DateField,
  Input,
  Listbox,
  Panel,
  ProgressBar,
  StatusText,
  Swatch,
  TypeChip,
} from "@/components/kit";
import {
  bumpProjectStatus,
  createProject,
  deleteProject,
  duplicateProject,
  setProjectComplete,
  updateProjectName,
  updateProjectPriority,
  updateProjectType,
} from "@/lib/actions/projects";
import {
  loadProjectDetail,
  loadProjectRecipeCards,
  setProjectArchived,
  setProjectReferenceImage,
  setProjectTargetDate,
  updateProjectNotes,
  type ProjectDetail,
  type ProjectRecipeCard,
} from "@/lib/actions/projectMeta";
import { cn } from "@/lib/cn";
import { formatMinutes, priorityAccent, statusAccent, STATUS_LABEL } from "@/lib/palette";
import type { Priority, Project, ProjectStatus, ProjectType } from "@/lib/types";
import { InspectorActionBar } from "./InspectorActionBar";

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

/** App display priority → DB priority enum (updateProjectPriority input). */
const PRIORITY_TO_DB: Record<Priority, "Low" | "Medium" | "High"> = {
  Low: "Low",
  Med: "Medium",
  High: "High",
};
/** App type → DB projectTypes literal (updateProject/createProject input). */
const TYPE_TO_DB: Record<ProjectType, "Army" | "Warband" | "Unit" | "Model" | "Terrain Piece"> = {
  Army: "Army",
  Warband: "Warband",
  Unit: "Unit",
  Model: "Model",
  Terrain: "Terrain Piece",
};

/**
 * Which child types a parent may host (mirrors the createProject containment
 * rules, Ross 2026-06-23). A type absent here is a leaf — no "+ Sub-project".
 */
const CHILD_TYPES: Partial<Record<ProjectType, ProjectType[]>> = {
  Army: ["Unit", "Warband", "Model", "Terrain"],
  Warband: ["Model"],
  Unit: ["Model"],
};

/** Mobile quick-jump rail targets (MOP-005) — order matches the section order. */
const QUICK_JUMP_SECTIONS: { anchorId: string; label: string }[] = [
  { anchorId: "inspector-details", label: "Details" },
  { anchorId: "inspector-sub-projects", label: "Sub" },
  { anchorId: "inspector-recipes", label: "Recipes" },
  { anchorId: "inspector-progress", label: "Progress" },
  { anchorId: "inspector-info", label: "Info" },
];

/**
 * A cyan-bordered section box matching the rest of the app, with a label
 * notched into the top border and a one-line body hint.
 *
 * Collapsible on mobile (MOP-005): below `md` the body collapses behind a
 * chevron toggle (local state, NOT native <details>), with `defaultOpen`
 * controlling its initial state — SUB-PROJECTS + PROGRESS open by default
 * (Ross's locked M4 call), the rest collapsed for a glanceable mobile view.
 * On `md`+ every section is always expanded (`md:block` forces the body open
 * and `md:hidden` removes the toggle) — collapsing is purely a mobile space
 * affordance. The chevron rotation rides the global `prefers-reduced-motion`
 * reset (globals.css zeroes transition-duration), so reduced-motion users get
 * an instant snap (M7 pattern).
 *
 * The outer `id={anchorId}` is the scroll target for the mobile quick-jump rail.
 */
function CollapsibleSection({
  label,
  hint,
  anchorId,
  defaultOpen,
  children,
}: {
  label: string;
  hint?: string;
  anchorId: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `${anchorId}-body`;
  return (
    <Panel label={label} className="p-4 pt-5">
      {/* scroll-mt keeps the notched label clear of the sticky header when the
          quick-jump rail scrolls this section into view. */}
      <div id={anchorId} className="scroll-mt-4">
        {/* Mobile-only collapse toggle. The Panel's notched label is the section
            identity, so the toggle is chevron-only with an aria-label naming the
            section; it sits as a full-width row above the body to give a ≥44px
            hit target without duplicating the visible label text. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={`${open ? "Collapse" : "Expand"} ${label} section`}
          onClick={() => setOpen((v) => !v)}
          className="-mt-2 -mr-2 mb-1 flex min-h-11 w-[calc(100%+0.5rem)] items-center justify-end md:hidden"
        >
          <span aria-hidden className={cn("shrink-0 text-cyan transition-transform", open && "rotate-90")}>
            ▸
          </span>
        </button>

        {/* Body: hidden when collapsed on mobile; always shown on md+. */}
        <div id={bodyId} className={cn(open ? "block" : "hidden", "md:block")}>
          {hint && <p className="mb-3 font-body text-body text-fg-dim">{hint}</p>}
          {children}
        </div>
      </div>
    </Panel>
  );
}

/** The red pixelated target — sets this project as the focus-bench subject. */
function FocusTargetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Focus this project"
      title="Focus — open this project in the focus bench timer to track your painting session."
      className="group shrink-0 border border-red/40 p-1.5 text-red transition-colors hover:bg-red/10 hover:border-red"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 11 11"
        shapeRendering="crispEdges"
        aria-hidden="true"
        className="text-glow-red"
      >
        {/* outer pixel ring */}
        <path
          fill="currentColor"
          d="M3 0h5v1H3zM2 1h1v1H2zM8 1h1v1H8zM1 2h1v1H1zM9 2h1v1H9zM0 3h1v5H0zM10 3h1v5h-1zM1 8h1v1H1zM9 8h1v1H9zM2 9h1v1H2zM8 9h1v1H8zM3 10h5v1H3z"
        />
        {/* centre dot */}
        <path fill="currentColor" d="M4 4h3v3H4z" />
      </svg>
    </button>
  );
}

/** Inline-editable project title in the page-title font. Commits on blur. */
function EditableTitle({
  id,
  title,
  tag: Tag,
  onSaved,
}: {
  id: string;
  title: string;
  tag: "h1" | "h2";
  onSaved: () => void;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [, start] = useTransition();

  function commit() {
    const next = ref.current?.textContent?.trim() ?? "";
    if (!next || next === title) {
      if (ref.current) ref.current.textContent = title;
      return;
    }
    start(async () => {
      const res = await updateProjectName({ id, name: next });
      if (res.ok) onSaved();
      else if (ref.current) ref.current.textContent = title;
    });
  }

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-label="Project name"
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          ref.current?.blur();
        }
      }}
      className="min-w-0 break-words font-title text-title leading-none text-green text-glow-green outline-none focus:bg-green/5"
    >
      {title}
    </Tag>
  );
}

export function ProjectWorkspaceBody({
  project,
  loggedMinutes,
  onAttachRecipe,
  onStartSession,
  onOpenSubProject,
  onClose,
  variant = "panel",
}: {
  project: Project;
  /** Logged minutes for this project + sub-projects (UX-011). */
  loggedMinutes?: number;
  onAttachRecipe?: (project: Project) => void;
  onStartSession?: (project: Project) => void;
  /** Open a sub-project — pushes a new panel tab (panel) or navigates (page). */
  onOpenSubProject?: (projectId: string) => void;
  onClose?: () => void;
  variant?: "panel" | "page";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [recipeCards, setRecipeCards] = useState<ProjectRecipeCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable notes / target date / reference image — seeded from the detail
  // fetch, then owned locally so typing is responsive.
  const [notes, setNotes] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [refUrl, setRefUrl] = useState("");

  // Add-sub-project type picker.
  const [pickingChild, setPickingChild] = useState(false);

  const children = project.children ?? [];
  const allowedChildren = CHILD_TYPES[project.type] ?? [];

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setRecipeCards(null);
    loadProjectDetail(project.id)
      .then((d) => {
        if (!alive || !d) return;
        setDetail(d);
        setNotes(d.notes ?? "");
        setTargetDate(d.targetDate ?? "");
        setRefUrl(d.referenceImageUrl ?? "");
      })
      .catch(() => {});
    loadProjectRecipeCards(project.id)
      .then((cards) => {
        if (alive) setRecipeCards(cards);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [project.id]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  function addChild(type: ProjectType) {
    setPickingChild(false);
    run(async () => {
      const res = await createProject({
        name: `New ${type}`,
        type: TYPE_TO_DB[type],
        parentId: project.id,
        count: 1,
      });
      // Open the freshly created sub-project so the painter lands on its
      // panel (a tier down) ready to rename + fill in — Ross's "new tab" flow.
      if (res.ok && res.data?.id) onOpenSubProject?.(res.data.id);
      return res;
    });
  }

  // On the standalone /projects/[id] page the title is the document's primary
  // heading (h1); in the slide-out the SlideOutPanel header supplies the dialog
  // title so the body title is an h2. Visual class is identical either way.
  const titleTag = variant === "page" ? "h1" : "h2";

  // Mobile quick-jump (MOP-005): scroll a section into view. If the target
  // section is collapsed, click its toggle first so it opens before we scroll —
  // keeps each section's collapse state local while still landing the painter on
  // expanded content. Scoped to this body's DOM via rootRef.
  const rootRef = useRef<HTMLDivElement>(null);
  function quickJump(anchorId: string) {
    const root = rootRef.current;
    if (!root) return;
    const toggle = root.querySelector<HTMLButtonElement>(
      `#${anchorId} > button[aria-expanded]`,
    );
    if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    root.querySelector(`#${anchorId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      {/* Title + overall progress + focus target */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <EditableTitle
            id={project.id}
            title={project.title}
            tag={titleTag}
            onSaved={() => router.refresh()}
          />
          <span className="font-body text-body text-fg-dim">
            {project.completionPercent}% complete
            {detail?.archived ? " · ARCHIVED" : ""}
          </span>
        </div>
        <FocusTargetButton onClick={() => onStartSession?.(project)} />
      </div>

      {/* Mobile quick-jump rail (MOP-005): segmented section anchors. Hidden on
          md+ where every section is already expanded and on-screen. Scrolls (and
          expands if needed) the matching section. Horizontally scrollable so it
          never forces page-width overflow on narrow phones. */}
      <nav
        aria-label="Jump to inspector section"
        className="-mx-1 flex gap-1 overflow-x-auto px-1 md:hidden"
      >
        {QUICK_JUMP_SECTIONS.map((s) => (
          <button
            key={s.anchorId}
            type="button"
            onClick={() => quickJump(s.anchorId)}
            className="shrink-0 border border-cyan/40 px-3 py-1 font-button text-button uppercase tracking-[0.15em] text-fg-dim transition-colors hover:border-cyan hover:text-cyan focus:outline-none focus-visible:border-cyan focus-visible:text-cyan"
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* DETAILS — type / status / priority */}
      <CollapsibleSection
        label="DETAILS"
        anchorId="inspector-details"
        defaultOpen={false}
        hint="Set the type, where it sits in your pipeline, and how urgent it is."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="label-osd text-fg-dim">Type</span>
            <Listbox
              value={project.type}
              disabled={pending}
              ariaLabel="Project type"
              options={TYPE_OPTIONS.map((t) => ({ value: t, label: t.toUpperCase() }))}
              onChange={(t) =>
                run(() => updateProjectType({ id: project.id, type: TYPE_TO_DB[t] }))
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-osd text-fg-dim">Status</span>
            <Listbox
              value={project.status}
              disabled={pending}
              ariaLabel="Project status"
              accent={statusAccent[project.status]}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              onChange={(s) => run(() => bumpProjectStatus({ id: project.id, status: s }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-osd text-fg-dim">Priority</span>
            <Listbox
              value={project.priority}
              disabled={pending}
              ariaLabel="Project priority"
              accent={priorityAccent[project.priority]}
              options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: p.toUpperCase() }))}
              onChange={(p) =>
                run(() =>
                  updateProjectPriority({ id: project.id, priority: PRIORITY_TO_DB[p] }),
                )
              }
            />
          </label>
        </div>
        {(detail?.faction || detail?.game) && (
          <p className="mt-3 font-body text-body text-fg">
            {[detail.faction, detail.game].filter(Boolean).join(" · ")}
          </p>
        )}
      </CollapsibleSection>

      {/* SUB-PROJECTS — the structure list. Click a row to open its panel. */}
      <CollapsibleSection
        label="SUB-PROJECTS"
        anchorId="inspector-sub-projects"
        defaultOpen
        hint="Track your project from the macro to the micro — add units, models, warbands or terrain, all under one roof."
      >
        {children.length > 0 ? (
          <ul className="flex flex-col">
            {children.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onOpenSubProject?.(c.id)}
                  className="flex w-full items-center gap-3 border-b border-fg/10 py-2 text-left transition-colors hover:bg-cyan/5"
                >
                  <span className="min-w-0 flex-1 truncate font-body text-body text-fg">
                    {c.title}
                  </span>
                  <TypeChip type={c.type} />
                  <span className="font-num2 text-num2 tabular-nums text-fg-dim">
                    {c.completionPercent}%
                  </span>
                  <span aria-hidden className="text-cyan">›</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-body text-body text-fg-dim">No sub-projects yet.</p>
        )}

        {allowedChildren.length > 0 &&
          (pickingChild ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="label-osd text-fg-dim">Add:</span>
              {allowedChildren.map((t) => (
                <Button key={t} variant="add" size="sm" disabled={pending} onClick={() => addChild(t)}>
                  {t}
                </Button>
              ))}
              <Button variant="tertiary" size="sm" onClick={() => setPickingChild(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="add"
              size="sm"
              className="mt-3 self-start"
              disabled={pending}
              onClick={() =>
                allowedChildren.length === 1 ? addChild(allowedChildren[0]) : setPickingChild(true)
              }
            >
              + Sub-project
            </Button>
          ))}
      </CollapsibleSection>

      {/* RECIPES — every recipe across this project + its sub-projects. */}
      <CollapsibleSection
        label="RECIPES"
        anchorId="inspector-recipes"
        defaultOpen={false}
        hint="Every paint recipe attached to this project and its sub-projects. Click one to open it."
      >
        {recipeCards === null ? (
          <p className="font-body text-body text-fg-dim">▸ Loading recipes…</p>
        ) : recipeCards.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-body text-body text-fg-dim">No recipes yet.</p>
            <Button variant="add" size="sm" onClick={() => onAttachRecipe?.(project)}>
              + Paint recipe
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recipeCards.map((rc) => (
              <button
                key={rc.id}
                type="button"
                onClick={() => router.push(`/recipes/${rc.id}`)}
                className="flex flex-col gap-2 border border-cyan/30 p-3 text-left transition-colors hover:border-cyan hover:bg-cyan/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-h2 text-h2 text-cyan">{rc.name}</span>
                  <span className="flex items-center gap-2">
                    <TypeChip type={rc.attachedProjectType} />
                    <span className="font-body text-body text-fg-dim">{rc.attachedProjectName}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {rc.palette.map((p, i) => (
                    <span key={`${p.hex}-${i}`} className="flex items-center gap-1">
                      <Swatch hex={p.hex} size="lg" />
                      <span className="font-body text-[0.65rem] leading-tight text-fg-dim">
                        {p.label}
                      </span>
                    </span>
                  ))}
                  {rc.palette.length === 0 && (
                    <span className="font-body text-body text-fg-dim">
                      {rc.slotCount} paint{rc.slotCount === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </button>
            ))}
            <Button variant="add" size="sm" className="self-start" onClick={() => onAttachRecipe?.(project)}>
              + Paint recipe
            </Button>
          </div>
        )}
      </CollapsibleSection>

      {/* PROGRESS — the working table: per-sub-project stage + completion. */}
      <CollapsibleSection
        label="PROGRESS"
        anchorId="inspector-progress"
        defaultOpen
        hint="Adjust each sub-project's stage and completion right here — completed rows light up green."
      >
        {children.length > 0 ? (
          <div className="flex flex-col gap-2">
            {children.map((c) => {
              const total = c.modelCount ?? 0;
              const done = c.modelsComplete ?? 0;
              const complete = c.status === "COMPLETE";
              return (
                <div
                  key={c.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 border p-2",
                    complete
                      ? "border-green bg-green/10 text-glow-green"
                      : "border-cyan/20",
                  )}
                >
                  <span className="min-w-[7rem] flex-1 truncate font-body text-body text-fg">
                    {c.title}
                  </span>
                  <Listbox
                    value={c.status}
                    disabled={pending}
                    ariaLabel={`Status for ${c.title}`}
                    accent={statusAccent[c.status]}
                    options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                    onChange={(s) => run(() => bumpProjectStatus({ id: c.id, status: s }))}
                  />
                  <div className="flex items-center gap-1 tabular-nums">
                    <button
                      type="button"
                      aria-label={`Decrease completed for ${c.title}`}
                      disabled={pending || done <= 0}
                      onClick={() =>
                        run(() => setProjectComplete({ id: c.id, complete: Math.max(0, done - 1) }))
                      }
                      className="inline-flex min-h-6 min-w-6 items-center justify-center border border-cyan/40 px-1 font-button text-button text-cyan hover:bg-cyan/10 disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="min-w-[2.75rem] text-center font-num2 text-num2 text-fg">
                      {done}/{total}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase completed for ${c.title}`}
                      disabled={pending || (total > 0 && done >= total)}
                      onClick={() => run(() => setProjectComplete({ id: c.id, complete: done + 1 }))}
                      className="inline-flex min-h-6 min-w-6 items-center justify-center border border-cyan/40 px-1 font-button text-button text-cyan hover:bg-cyan/10 disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <div className="min-w-[6rem] flex-1">
                    <ProgressBar percent={c.completionPercent} showLabel />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="font-body text-body text-fg-dim">
            Add sub-projects above to track their stages here.
          </p>
        )}

        {/* Roll-up stat strip. */}
        <div className={cn("mt-3 grid gap-2", loggedMinutes != null ? "grid-cols-4" : "grid-cols-3")}>
          <StatCell label="Total models" value={project.modelCount ?? 0} />
          <StatCell label="Completed" value={project.modelsComplete ?? 0} />
          <StatCell label="Sub-projects" value={children.length} />
          {loggedMinutes != null && (
            <StatCell label="Time" value={formatMinutes(loggedMinutes)} />
          )}
        </div>
      </CollapsibleSection>

      {/* INFO — notes / techniques, deadline, reference image. */}
      <CollapsibleSection
        label="INFO"
        anchorId="inspector-info"
        defaultOpen={false}
        hint="Notes and techniques, a target date, and a reference image to paint towards."
      >
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => run(() => updateProjectNotes({ id: project.id, notes }))}
          rows={3}
          placeholder="Notes & techniques — e.g. edge highlight Terminators with Stormhost Silver…"
          className="w-full resize-y border border-cyan/40 bg-bg px-3 py-2 font-body text-body text-fg focus:border-cyan focus:outline-none"
        />
        <div className="mt-3 flex items-center gap-2">
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
        <div className="mt-3 flex flex-col gap-2">
          <span className="label-osd text-fg-dim">Reference image</span>
          {refUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={refUrl}
              alt={`${project.title} reference`}
              className="max-h-48 w-full border border-cyan/30 object-contain"
            />
          )}
          <div className="flex gap-2">
            <Input
              name="reference-url"
              value={refUrl}
              onChange={(e) => setRefUrl(e.target.value)}
              placeholder="https://…/reference.jpg"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setProjectReferenceImage({ id: project.id, url: refUrl || null }))}
            >
              Save
            </Button>
          </div>
        </div>
      </CollapsibleSection>

      {error && <p className="font-body text-body text-red">▸ {error}</p>}

      {/* Sticky action bar (MOP-002): Focus stays prominent; Open full page /
          Archive / Duplicate / Delete are demoted into the ⋯ overflow so the
          destructive verb leaves the thumb-rest zone. Delete still routes
          through the ConfirmDialog below. */}
      <InspectorActionBar
        onFocus={onStartSession ? () => onStartSession(project) : undefined}
        disabled={pending}
        actions={[
          // Hidden on mobile (MOP-012) — the panel is full-bleed below md, so
          // "open full page" is redundant there; desktop-only via desktopOnly.
          ...(variant === "panel"
            ? [
                {
                  key: "open-full",
                  label: "⤢ Open full page",
                  desktopOnly: true,
                  onClick: () => router.push(`/projects/${project.id}`),
                },
              ]
            : []),
          {
            key: "archive",
            label: detail?.archived ? "⊞ Unarchive" : "⊟ Archive",
            onClick: () =>
              run(() =>
                setProjectArchived({ id: project.id, archived: !detail?.archived }),
              ),
          },
          {
            key: "duplicate",
            label: "⧉ Duplicate",
            onClick: () =>
              run(async () => {
                const res = await duplicateProject({ id: project.id });
                if (res.ok && res.data?.id) onOpenSubProject?.(res.data.id);
                return res;
              }),
          },
          {
            key: "delete",
            label: "🗑 Delete",
            tone: "danger" as const,
            onClick: () => setConfirmingDelete(true),
          },
        ]}
      />
      <ConfirmDialog
        open={confirmingDelete}
        breadcrumb="PROJECT"
        title="Delete project?"
        message={`Delete "${project.title}" and its sub-projects? This can't be undone.`}
        confirmLabel="Delete"
        destructive
        busy={pending}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          run(async () => {
            const res = await deleteProject({ id: project.id });
            if (res.ok) onClose?.();
            return res;
          });
        }}
      />
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 border border-cyan/20 px-2 py-3">
      <span className="font-num2 text-num2 tabular-nums text-fg">{value}</span>
      <span className="label-osd text-fg-dim">{label}</span>
    </div>
  );
}
