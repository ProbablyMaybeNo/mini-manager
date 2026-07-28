"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  DateField,
  FocusReticleIcon,
  IconButton,
  Input,
  Listbox,
  Panel,
  ProgressBar,
  StatusText,
  Swatch,
  SwatchStrip,
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
import { detachRecipe } from "@/lib/actions/recipes";
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
import { ModelCounterGrid } from "./ModelCounterGrid";
import { ProjectImagePanel } from "./ProjectImagePanel";

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
  { anchorId: "inspector-photos", label: "Photos" },
  { anchorId: "inspector-sub-projects", label: "Sub" },
  { anchorId: "inspector-recipes", label: "Recipes" },
  { anchorId: "inspector-progress", label: "Progress" },
  { anchorId: "inspector-info", label: "Ref" },
];

/**
 * A cyan-bordered section box matching the rest of the app, with a label
 * notched into the top border and a one-line body hint.
 *
 * Collapsible on mobile (MOP-005): below `md` the body collapses behind a
 * toggle (local state, NOT native <details>), with `defaultOpen` controlling
 * its initial state — SUB-PROJECTS + PROGRESS open by default (Ross's locked M4
 * call), the rest collapsed for a glanceable mobile view. On `md`+ every
 * section is always expanded (`md:block` forces the body open and `md:hidden`
 * removes the toggle) — collapsing is purely a mobile space affordance. The
 * chevron rotation rides the global `prefers-reduced-motion` reset (globals.css
 * zeroes transition-duration), so reduced-motion users get an instant snap (M7).
 *
 * The `hint` line sits OUTSIDE the collapsible body (Ross, 2026-07-27) so a
 * collapsed card still says what it's for — collapsed used to leave a bare
 * label and a lone chevron. On mobile the hint doubles as the toggle's label,
 * which also gives the control a full-width ≥44px target instead of a 24px
 * chevron floating at the right edge.
 *
 * The outer `id={anchorId}` is the scroll target for the mobile quick-jump rail.
 */
function CollapsibleSection({
  label,
  hint,
  anchorId,
  defaultOpen,
  className,
  dataWalkthrough,
  fill,
  children,
}: {
  label: string;
  hint?: string;
  anchorId: string;
  defaultOpen: boolean;
  /** Extra classes on the Panel — used for variant-specific flex ordering. */
  className?: string;
  /** First-create walkthrough anchor id placed on the section's outer Panel. */
  dataWalkthrough?: string;
  /** Stretch the body to fill the panel's grid-stretched height (md+), so a
   *  trailing `flex-1` child (e.g. DETAILS' Notes) anchors to the bottom and
   *  balances a taller sibling panel like PHOTOS. */
  fill?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `${anchorId}-body`;
  return (
    <Panel
      label={label}
      className={cn("p-4 pt-5", fill && "flex flex-col", className)}
      data-walkthrough={dataWalkthrough}
    >
      {/* scroll-mt keeps the notched label clear of the sticky header when the
          quick-jump rail scrolls this section into view. */}
      <div id={anchorId} className={cn("scroll-mt-4", fill && "flex flex-1 flex-col")}>
        {/* Mobile-only collapse toggle — the hint IS the label, so a collapsed
            card still describes itself and the target spans the full row. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={`${open ? "Collapse" : "Expand"} ${label} section`}
          onClick={() => setOpen((v) => !v)}
          className="-mt-2 mb-3 flex min-h-11 w-full items-start gap-3 text-left md:hidden"
        >
          {/* Ross's call: a collapsed card still describes itself. But six
              sections × 2–3 lines of prose was ~135px per closed section
              (MUX-004), so closed clamps to one line and opening reveals the
              rest — the description survives, the paragraph doesn't. */}
          <span
            className={cn(
              "min-w-0 flex-1 font-body text-body text-fg-dim",
              !open && "line-clamp-1",
            )}
          >
            {hint}
          </span>
          <span
            aria-hidden
            className={cn(
              "mt-0.5 shrink-0 text-cyan-lite transition-transform",
              open && "rotate-90",
            )}
          >
            ▸
          </span>
        </button>

        {/* Desktop hint — the mobile copy above is inside the toggle button. */}
        {hint && <p className="mb-3 hidden font-body text-body text-fg-dim md:block">{hint}</p>}

        {/* Body: hidden when collapsed on mobile; always shown on md+. When
            `fill`, the md+ body becomes a flex column so a trailing flex-1 child
            stretches to the bottom (we swap `md:block` for `md:flex` to avoid a
            display-utility collision). */}
        <div
          id={bodyId}
          className={cn(
            open ? "block" : "hidden",
            fill ? "md:flex md:flex-1 md:flex-col" : "md:block",
          )}
        >
          {children}
        </div>
      </div>
    </Panel>
  );
}

/**
 * Inline-editable project NAME field, relocated into DETAILS (RF-4) now that the
 * big duplicate title is gone — the breadcrumb / page heading names the project,
 * this is where you rename it. Seeded from the project name, owned locally so
 * typing stays responsive, commits on blur / Enter via updateProjectName.
 */
function RenameField({
  id,
  name,
  disabled,
  onSaved,
}: {
  id: string;
  name: string;
  disabled?: boolean;
  onSaved?: () => void;
}) {
  const [value, setValue] = useState(name);
  const [, start] = useTransition();
  // Re-seed if the project changes underneath us (e.g. switching tabs).
  const lastName = useRef(name);
  if (lastName.current !== name) {
    lastName.current = name;
    setValue(name);
  }

  function commit() {
    const next = value.trim();
    if (!next || next === name) {
      setValue(name);
      return;
    }
    start(async () => {
      const res = await updateProjectName({ id, name: next });
      if (res.ok) onSaved?.();
      else setValue(name);
    });
  }

  return (
    <Input
      name="project-name"
      label="Name"
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
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
  // Optimistic view-model for the DETAILS Type/Status/Priority dropdowns: the
  // picked value paints synchronously (no waiting on the server round-trip),
  // then resets to the freshly-rendered prop once the force-dynamic host
  // re-renders from the server-action POST (P1 — no useState freeze).
  const [optimisticProject, applyOptimistic] = useOptimistic(
    project,
    (state: Project, patch: Partial<Project>) => ({ ...state, ...patch }),
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // PP-2: a sub-project queued for a confirm-guarded delete from the
  // SUB-PROJECTS list's trailing Trash2 icon.
  const [deletingChild, setDeletingChild] = useState<Project | null>(null);
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
  // PP-2: on the project PAGE the layout is sub-project-list-first — the
  // SUB-PROJECTS section leads (order-first), the secondary DETAILS / RECIPES /
  // PROGRESS / INFO sections follow, and DETAILS/RECIPES default collapsed. The
  // panel (dashboard slide-out) keeps its existing top-down order. Ordering is
  // applied via flex `order-*` utilities so the JSX (and its anchors) stays put.
  const isPage = variant === "page";

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

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    optimistic?: Partial<Project>,
  ) {
    setError(null);
    startTransition(async () => {
      // Apply the optimistic patch synchronously before awaiting, so the
      // dropdown shows the new value immediately.
      if (optimistic) applyOptimistic(optimistic);
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      // No router.refresh(): both host pages are force-dynamic, so the
      // server-action POST already re-renders the tree with fresh props
      // (P2). Dropping it also kills the redundant ~18-request RSC storm.
    });
  }

  // Detach a recipe from its project. Optimistically drop the card, persist via
  // detachRecipe, then refresh so the roster / panel swatches update in place.
  function detach(recipeId: string) {
    setRecipeCards((cards) => cards?.filter((c) => c.id !== recipeId) ?? cards);
    run(() => detachRecipe({ recipeId }));
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
      {/* Mobile quick-jump rail (MOP-005): segmented section anchors. Hidden on
          md+ where every section is already expanded and on-screen. Scrolls (and
          expands if needed) the matching section. Horizontally scrollable so it
          never forces page-width overflow on narrow phones. */}
      {/* Wraps to two rows of three rather than scrolling (MUX-002). As a
          scroller it was 490px of tabs in a 351px box: PROGRESS and REF sat
          entirely off-screen, and because RECIPES ended flush at the right edge
          the row read as complete — so the section where completion is actually
          set looked like it didn't exist. */}
      <nav
        aria-label="Jump to inspector section"
        className="grid grid-cols-3 gap-1 md:hidden"
      >
        {QUICK_JUMP_SECTIONS.map((s) => (
          <button
            key={s.anchorId}
            type="button"
            onClick={() => quickJump(s.anchorId)}
            className="min-h-8 border border-cyan/40 px-2 py-1 font-button text-button uppercase tracking-[0.1em] text-fg-dim transition-colors hover:border-cyan hover:text-cyan-lite focus:outline-none focus-visible:border-cyan focus-visible:text-cyan-lite"
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Panel header row (RF-4 / project-view overhaul): the editable NAME leads
          at the top-left — moved up out of DETAILS so it's the first thing you
          see and edit — with "⤢ Open full page" pushed across to the top-right.
          The inspector chrome (InspectorPane / ProjectBottomSheet) still carries
          the breadcrumb + close X above this, so we don't repeat those here. */}
      {!isPage && (
        <div className="flex items-start justify-between gap-3" data-walkthrough="name">
          <div className="min-w-0 flex-1">
            <RenameField
              id={project.id}
              name={project.title}
              disabled={pending}
            />
          </div>
          <button
            type="button"
            // Navigate forward (no onClose) — the inspector's history-unwind on
            // close would fight the push. ProjectPanelStack's unmount cleanup
            // skips its unwind when we've navigated past the inspector entry.
            onClick={() => router.push(`/projects/${project.id}`)}
            className="mt-6 inline-flex min-h-11 shrink-0 items-center gap-1.5 font-mono text-[11px] text-fg-faint transition-colors hover:text-cyan-lite focus:outline-none focus-visible:text-cyan-lite md:min-h-6"
          >
            ⤢ Open full page
          </button>
        </div>
      )}

      {/* Compact PROGRESS summary strip (RF-6): a dense, glanceable trio at the
          very top — total models · completed · time spent. The detailed
          per-sub-project steppers + status dropdowns still live in the PROGRESS
          section below. On the PAGE variant this trio lives in the page header's
          overall-progress strip instead (PP-2), so it's suppressed here to avoid
          a duplicate. */}
      {!isPage && (
        // At phone width the trio wraps to a 2-up grid so no label is clipped
        // to an ellipsis (MUX-004); the inline dot-separated row returns once
        // there's room (≥420px). The dots only show in the inline layout.
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border border-cyan/30 bg-bg-raised/30 px-3 py-2 min-[420px]:flex min-[420px]:items-center min-[420px]:gap-2">
          <ProgressStat
            glyph="#"
            label="total"
            value={project.modelCount ?? 0}
          />
          <span aria-hidden className="hidden text-fg-faint min-[420px]:inline">·</span>
          <ProgressStat
            glyph="✓"
            label="complete"
            value={project.modelsComplete ?? 0}
            accent="green"
          />
          <span aria-hidden className="hidden text-fg-faint min-[420px]:inline">·</span>
          <ProgressStat
            glyph="🕒"
            label="time"
            value={formatMinutes(loggedMinutes ?? 0)}
          />
        </div>
      )}

      {/* DETAILS + PHOTOS — side by side on desktop (lg:grid-cols), stacked on
          mobile. Secondary on the page (order-2, both collapsed by default on
          mobile); leads the panel's DETAILS-first order. A freshly-created
          draft still named "New Project" opens DETAILS by default so the name
          field is immediately visible to rename on phones (UX-005 / MUX-005). */}
      <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]", isPage && "order-2")}>
        <CollapsibleSection
          label="DETAILS"
          anchorId="inspector-details"
          defaultOpen={project.title === "New Project"}
          fill
          hint="Set the type, where it sits in your pipeline, and how urgent it is — plus a target date and your notes."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-walkthrough="meta">
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
          {(detail?.faction || detail?.game) && (
            <p className="mt-3 font-body text-body text-fg">
              {[detail.faction, detail.game].filter(Boolean).join(" · ")}
            </p>
          )}

          {/* Target date — pulled up from the old INFO section (absorbed). */}
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

          {/* Notes — anchored to the bottom (md+ flex-1) so DETAILS fills its
              grid-stretched cell and balances the tall PHOTOS panel beside it,
              killing the empty gap that sat below the old short DETAILS. */}
          <div className="mt-3 flex flex-col md:flex-1">
            <span className="label-osd text-fg-dim">Notes &amp; techniques</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => run(() => updateProjectNotes({ id: project.id, notes }))}
              rows={4}
              aria-label="Notes & techniques"
              placeholder="Notes & techniques — e.g. edge highlight Terminators with Stormhost Silver…"
              className="mt-1 w-full flex-1 resize-y border border-cyan/40 bg-bg px-3 py-2 font-body text-body text-fg focus:border-cyan focus:outline-none"
            />
          </div>
        </CollapsibleSection>

        {/* PHOTOS — Recipe-card phase 1: real uploaded photos of the finished
            model (distinct from the pasted-URL "Reference image" in INFO
            below). Cycle with `< >`, click to open the full-screen viewer. */}
        {/* Collapsed by default (MUX-004): expanded, its ~300px "NO PHOTOS YET"
            empty state sat above SUB-PROJECTS and pushed the first real control
            to y=748 — the inspector opened on an empty well. */}
        <CollapsibleSection
          label="PHOTOS"
          anchorId="inspector-photos"
          defaultOpen={false}
          hint="A photo of your finished model — cycle with the arrows, click to view full-screen."
        >
          <ProjectImagePanel projectId={project.id} />
        </CollapsibleSection>
      </div>

      {/* SUB-PROJECTS — the structure list and the page's centerpiece (PP-2):
          each row is name + recipe swatches + progress + edit/focus/delete.
          Leads the page (order-1); sits third in the panel. */}
      <CollapsibleSection
        label="SUB-PROJECTS"
        anchorId="inspector-sub-projects"
        defaultOpen
        className={isPage ? "order-1" : undefined}
        hint="Track your project from the macro to the micro — add units, models, warbands or terrain, all under one roof."
      >
        {children.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {children.map((c) => (
              <SubProjectRow
                key={c.id}
                child={c}
                disabled={pending}
                onOpen={() => onOpenSubProject?.(c.id)}
                onFocus={onStartSession ? () => onStartSession(c) : undefined}
                onDelete={() => setDeletingChild(c)}
              />
            ))}
          </ul>
        ) : (
          <p className="font-body text-body text-fg-dim">No sub-projects yet.</p>
        )}

        {allowedChildren.length > 0 &&
          (pickingChild ? (
            <div className="mt-3 flex flex-wrap items-center gap-2" data-walkthrough="sub">
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
              data-walkthrough="sub"
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
        className={isPage ? "order-3" : undefined}
        dataWalkthrough="recipes"
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
              <div
                key={rc.id}
                className="flex flex-col gap-2 border border-cyan/30 p-3 transition-colors hover:border-cyan hover:bg-cyan/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/recipes/${rc.id}?from=${rc.attachedProjectId}`)}
                    className="min-w-0 flex-1 text-left font-h2 text-h2 text-cyan-lite hover:text-glow-cyan focus:outline-none focus-visible:underline"
                  >
                    <span className="truncate">{rc.name}</span>
                  </button>
                  <span className="flex shrink-0 items-center gap-2">
                    <TypeChip type={rc.attachedProjectType} />
                    <span className="font-body text-body text-fg-dim">{rc.attachedProjectName}</span>
                    {/* Detach affordance — removes the recipe from this project
                        (the recipe itself is kept, just unlinked). */}
                    <IconButton
                      variant="outlineRed"
                      size="sm"
                      className="h-7 w-7"
                      aria-label={`Detach ${rc.name}`}
                      title="Detach recipe"
                      disabled={pending}
                      onClick={() => detach(rc.id)}
                    >
                      ✕
                    </IconButton>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/recipes/${rc.id}?from=${rc.attachedProjectId}`)}
                  className="flex flex-wrap items-center gap-2 text-left focus:outline-none focus-visible:underline"
                >
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
                </button>
              </div>
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
        className={isPage ? "order-4" : undefined}
        dataWalkthrough="progress"
        hint={
          children.length > 0
            ? "Adjust each sub-project's stage and completion right here — completed rows light up green."
            : project.type !== "Army" && project.type !== "Warband"
              ? "Set the model count, then tick off each stage (Built → Completed) as you paint."
              : "Add sub-projects above to track their stages here."
        }
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
                      className="inline-flex min-h-11 min-w-11 items-center justify-center border border-cyan/40 px-1 font-button text-button text-cyan-lite hover:bg-cyan/10 disabled:opacity-30 md:min-h-6 md:min-w-6"
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
                      className="inline-flex min-h-11 min-w-11 items-center justify-center border border-cyan/40 px-1 font-button text-button text-cyan-lite hover:bg-cyan/10 disabled:opacity-30 md:min-h-6 md:min-w-6"
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
        ) : project.type !== "Army" && project.type !== "Warband" ? (
          // A leaf unit *is* a set of models — track its own painting stages +
          // set its model count right here (the standalone flow panel's grid,
          // folded into the one inspector).
          <ModelCounterGrid project={project} />
        ) : (
          <p className="font-body text-body text-fg-dim">
            Add sub-projects above to track their stages here.
          </p>
        )}

        {/* Roll-up stat strip — 2-up on phones so the 4th cell + its label
            aren't clipped off the right edge (MUX-004). Container-only: a leaf's
            own totals live in its ModelCounterGrid above. */}
        {/* Desktop only in the panel: the compact strip at the top of the
            inspector already prints total / complete / time, so on a phone this
            was the same three numbers a second time (MUX-009). */}
        {children.length > 0 && (
          <div
            className={cn(
              "mt-3 gap-2",
              isPage ? "grid" : "hidden md:grid",
              loggedMinutes != null ? "grid-cols-2 min-[420px]:grid-cols-4" : "grid-cols-3",
            )}
          >
            <StatCell label="Total models" value={project.modelCount ?? 0} />
            <StatCell label="Completed" value={project.modelsComplete ?? 0} />
            <StatCell label="Sub-projects" value={children.length} />
            {loggedMinutes != null && (
              <StatCell label="Time" value={formatMinutes(loggedMinutes)} />
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* REFERENCE — the pasted-URL inspiration image to paint towards (distinct
          from the uploaded model PHOTOS above). Notes + target date moved up into
          DETAILS (INFO absorbed), so this section is now just the reference. */}
      <CollapsibleSection
        label="REFERENCE"
        anchorId="inspector-info"
        defaultOpen={false}
        className={isPage ? "order-5" : undefined}
        hint="A reference image to paint towards — paste a link to your inspiration (kept separate from your own model photos above)."
      >
        <div className="flex flex-col gap-2">
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
              aria-label="Reference image URL"
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

      {/* error + action bar — kept last in the flex column. On the page variant
          they carry order-6 so they sit below the ordered sections (the un-
          ordered default order-0 would otherwise float them above SUB-PROJECTS). */}
      <div className={cn("flex flex-col gap-4", isPage && "order-6")}>
        {error && <p className="font-body text-body text-red-text">▸ {error}</p>}

        {/* Sticky action bar (RF-1): a visible row of labelled buttons —
            FOCUS · DELETE · SAVE · Archive · Duplicate. SAVE flushes the locally
            held INFO edits (notes / target date / reference image). Delete still
            routes through the ConfirmDialog below. */}
        <InspectorActionBar
        disabled={pending}
        archived={!!detail?.archived}
        onFocus={onStartSession ? () => onStartSession(project) : undefined}
        onDelete={() => setConfirmingDelete(true)}
        onSave={() =>
          run(async () => {
            const results = await Promise.all([
              updateProjectNotes({ id: project.id, notes }),
              setProjectTargetDate({ id: project.id, date: targetDate || null }),
              setProjectReferenceImage({ id: project.id, url: refUrl || null }),
            ]);
            return results.find((r) => !r.ok) ?? { ok: true };
          })
        }
        onArchive={() =>
          run(() =>
            setProjectArchived({ id: project.id, archived: !detail?.archived }),
          )
        }
        onDuplicate={() =>
          run(async () => {
            const res = await duplicateProject({ id: project.id });
            if (res.ok && res.data?.id) onOpenSubProject?.(res.data.id);
            return res;
          })
        }
        />
      </div>
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
      {/* PP-2: confirm-guarded delete for a sub-project row's Trash2 icon.
          Deleting a sub-project stays on this page (the parent re-renders
          without it). */}
      <ConfirmDialog
        open={deletingChild != null}
        breadcrumb="SUB-PROJECT"
        title="Delete sub-project?"
        message={
          deletingChild
            ? `Delete "${deletingChild.title}" and its sub-projects? This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        busy={pending}
        onClose={() => setDeletingChild(null)}
        onConfirm={() => {
          const target = deletingChild;
          setDeletingChild(null);
          if (!target) return;
          run(() => deleteProject({ id: target.id }));
        }}
      />
    </div>
  );
}

/**
 * A SUB-PROJECTS list row (PP-2): the sub-project name (clickable → drills into
 * its page), its recipe swatch squares, a progress bar, and trailing actions.
 *
 * Action strip reworked 2026-07-27 (Ross: "I don't know what any of those icons
 * mean and shouldn't they be smaller"). Three 32px glyph buttons — a pencil, a
 * focus reticle and a bin — dominated the row and only the bin read as anything.
 * Now: the redundant pencil is gone (tapping the name already opens the
 * sub-project to edit it), FOCUS is a word rather than a reticle, and the bin
 * drops to 28px.
 */
function SubProjectRow({
  child,
  disabled,
  onOpen,
  onFocus,
  onDelete,
}: {
  child: Project;
  disabled?: boolean;
  onOpen: () => void;
  onFocus?: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border border-cyan/20 p-3 transition-colors hover:border-cyan/40">
      {/* Name + type — the name click drills into the sub-project's page. */}
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-[8rem] flex-1 items-center gap-2 text-left focus:outline-none focus-visible:underline"
      >
        <span className="min-w-0 flex-1 truncate font-h2 text-h2 text-cyan-lite hover:text-glow-cyan">
          {child.title}
        </span>
        <TypeChip type={child.type} />
      </button>

      {/* Recipe swatches — non-interactive here (editing the recipe happens on
          the sub-project's own page); empty → a quiet "no recipe" note. */}
      {child.recipeSwatches.length > 0 ? (
        <SwatchStrip swatches={child.recipeSwatches} />
      ) : (
        <span className="label-osd text-fg-faint">no recipe</span>
      )}

      {/* Progress bar — fixed-ish width so the row reads as a consistent grid. */}
      <div className="min-w-[7rem] flex-1 basis-40">
        <ProgressBar
          percent={child.completionPercent}
          accent={child.completionPercent >= 100 ? "green" : "cyan"}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {onFocus && (
          <button
            type="button"
            onClick={onFocus}
            title="Open in the focus bench"
            className="inline-flex h-7 items-center gap-1.5 border border-purple/50 px-2 font-button text-button uppercase tracking-[0.12em] text-purple transition-colors hover:bg-purple/10 focus:outline-none focus-visible:bg-purple/10"
          >
            <FocusReticleIcon size={13} />
            Focus
          </button>
        )}
        <IconButton
          variant="outlineRed"
          size="sm"
          className="h-7 w-7"
          aria-label={`Delete ${child.title}`}
          title="Delete sub-project"
          disabled={disabled}
          onClick={onDelete}
        >
          <Trash2 size={14} aria-hidden />
        </IconButton>
      </div>
    </li>
  );
}

/** One cell of the compact top PROGRESS strip (RF-6): glyph + value + tiny
 *  label, all on one dense line. */
function ProgressStat({
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
      <span aria-hidden className={cn("shrink-0", accent === "green" ? "text-green" : "text-cyan-lite")}>
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

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 border border-cyan/20 px-2 py-3">
      <span className="font-num2 text-num2 tabular-nums text-fg">{value}</span>
      <span className="label-osd text-fg-dim">{label}</span>
    </div>
  );
}
