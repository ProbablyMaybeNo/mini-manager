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
    // Tighter box when collapsed (MUX2-010): the round-1 clamp shrank the TEXT
    // to one line but the card stayed 122px — ~76px of content in a 122px box,
    // with up to 29px of dead space below it. Four collapsed sections were 60%
    // of the fold. Padding relaxes as soon as it opens.
    <Panel
      label={label}
      className={cn(
        open ? "p-4 pt-5" : "px-4 pb-2 pt-4 md:p-4 md:pt-5",
        fill && "flex flex-col",
        className,
      )}
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
          className={cn(
            // Full-width row, so a 36px height is still an enormous target when
            // collapsed; it relaxes to 44px + a gap once open.
            "-mt-2 flex w-full items-start gap-3 text-left md:hidden",
            open ? "mb-3 min-h-11" : "mb-0 min-h-9",
          )}
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
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
      return;
    }
    setError(null);
    start(async () => {
      // R2-2 — an awaited server action that REJECTS inside a transition
      // propagates to the route error boundary, so a phone losing signal for
      // two seconds replaced the entire app with the "SOMETHING BROKE" fault
      // screen and took the typed name with it. A failed fetch is not an
      // unrecoverable render fault. Catch it, keep what was typed (blurring
      // again retries the save), and leave the rest of the panel usable.
      try {
        const res = await updateProjectName({ id, name: next });
        if (res.ok) onSaved?.();
        else setError(res.error);
      } catch {
        setError("Couldn’t save the name — check your connection, then try again.");
      }
    });
  }

  return (
    <Input
      name="project-name"
      label="Name"
      value={value}
      error={error ?? undefined}
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
  // A leaf owns models directly, so it gets the stage counters. Anything with
  // sub-projects gets its progress from their rows instead — see PROGRESS below.
  const isLeaf =
    children.length === 0 && project.type !== "Army" && project.type !== "Warband";
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
      // R2-2 — every mutation in this panel funnels through here, and an
      // action that REJECTS (offline, dropped connection) rather than
      // returning `{ ok: false }` escapes the transition into the route error
      // boundary, replacing the whole app with the fault screen. Report it in
      // the panel's own error slot instead; the optimistic patch reverts on
      // the next server render, exactly as it does for a handled failure.
      try {
        const res = await action();
        if (!res.ok) {
          setError(res.error ?? "Something went wrong.");
          return;
        }
      } catch {
        setError("Couldn’t save — check your connection, then try again.");
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

  /**
   * Create one sub-project from the inline form and STAY PUT (Ross,
   * 2026-08-01).
   *
   * This used to mint a "New Unit" and immediately open it, so building an
   * army of three units cost three context switches and three renames. The
   * form captures name / type / models / priority / status up front, and
   * returning here — form still open, fields reset — means the next unit is
   * one more fill-in rather than a round trip. Recipes and progress still
   * live on each sub-project's own page; this is only the roster-building
   * half of the job.
   *
   * Status is applied via `bumpProjectStatus` rather than the insert because
   * it's derived from the model counters, and that action owns the counter
   * math. Only called when the painter picked something other than the
   * default, so the common path stays a single round-trip.
   */
  function addChild(draft: {
    name: string;
    type: ProjectType;
    count: number;
    priority: Priority;
    status: ProjectStatus;
  }) {
    run(async () => {
      const res = await createProject({
        name: draft.name.trim() || `New ${draft.type}`,
        type: TYPE_TO_DB[draft.type],
        parentId: project.id,
        count: draft.count,
        priority: PRIORITY_TO_DB[draft.priority],
      });
      if (!res.ok) return res;
      if (draft.status !== "WISHLIST" && res.data?.id) {
        const bumped = await bumpProjectStatus({ id: res.data.id, status: draft.status });
        if (!bumped.ok) return bumped;
      }
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
    // min-h-full gives the sticky action bar a containing block taller than
    // itself. Without it every ancestor sized to content, so `sticky bottom-0`
    // had nowhere to stick and SAVE sat ~2 screens below the fold (MUX2-007).
    <div ref={rootRef} className="flex min-h-full flex-col gap-4">
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
        {QUICK_JUMP_SECTIONS.filter(
          (s) => s.anchorId !== "inspector-progress" || isLeaf,
        ).map((s) => (
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
            // Navigate forward (no onClose): the inspector's entry stays behind
            // the page, so Back returns to the dashboard with the panel open.
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
        // Three stats, three columns (MUX2-008). The 2-up grid wrapped 2+1 and
        // left the bottom-right cell empty, spending 72px on values that fit in
        // one 30px row. The inline dot-separated row returns at ≥420px; the
        // dots only show in that layout.
        <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 border border-cyan/30 bg-bg-raised/30 px-3 py-2 min-[420px]:flex min-[420px]:items-center min-[420px]:gap-2">
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
          {/* No glyph on the third stat (MUX3-009): three equal 98px columns
              left the clock emoji 22px, so "0h 00m" wrapped to two lines and
              "time" clipped to "TI…". The label already says TIME. */}
          <ProgressStat
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
            <AddSubProjectForm
              allowedTypes={allowedChildren}
              busy={pending}
              onAdd={addChild}
              onClose={() => setPickingChild(false)}
            />
          ) : (
            <Button
              variant="add"
              size="sm"
              className="mt-3 self-start"
              data-walkthrough="sub"
              disabled={pending}
              onClick={() => setPickingChild(true)}
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

      {/* PROGRESS — a leaf's own stage counters, and only a leaf's (Ross,
          2026-08-01). A container used to repeat every sub-project here as a
          second table with its own stepper and status pill; but each row in
          SUB-PROJECTS already carries a progress bar, so this was the same
          information a section further down the page. Progress gets ticked off
          on the unit's own page, where the counters actually live. */}
      {isLeaf && (
        <CollapsibleSection
          label="PROGRESS"
          anchorId="inspector-progress"
          defaultOpen
          className={isPage ? "order-4" : undefined}
          dataWalkthrough="progress"
          hint="Set the model count, then tick off each stage (Built → Completed) as you paint."
        >
          {/* A leaf unit *is* a set of models — track its own painting stages +
              set its model count right here (the standalone flow panel's grid,
              folded into the one inspector). */}
          <ModelCounterGrid project={project} />
        </CollapsibleSection>
      )}

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
      {error && (
        <p className={cn("font-body text-body text-red-text", isPage && "order-6")}>▸ {error}</p>
      )}

      {/* Action bar (RF-1): FOCUS · ARCHIVE · DUPLICATE · DELETE in flow, with
          SAVE pinned. It is a DIRECT child of the min-h-full column (MUX3-003) —
          a sticky element sticks within its PARENT, and it was nested in a
          wrapper that sized to its own content (181px against a 173px bar), so
          it had 8px of travel and tracked scroll 1:1. The previous min-h-full
          landed on the grandparent, which does nothing for it. SAVE flushes the
          locally held edits; Delete still routes through the ConfirmDialog. */}
      <InspectorActionBar
        className={cn("mt-auto", isPage && "order-6")}
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
 * Inline "add a sub-project" form (Ross, 2026-08-01).
 *
 * Replaces a flow that minted a placeholder "New Unit" and immediately opened
 * it, so adding three units to an army meant three context switches and three
 * renames. Everything cheap to capture — name, type, model count, priority,
 * status — is captured here; the form stays open and resets after each add, so
 * building a roster is a sequence of fill-ins rather than round trips. Recipes,
 * photos and per-model progress still live on each sub-project's own page,
 * reachable from its row once it exists.
 *
 * Enter submits, so a whole unit can be added without leaving the keyboard.
 */
function AddSubProjectForm({
  allowedTypes,
  busy,
  onAdd,
  onClose,
}: {
  allowedTypes: ProjectType[];
  busy?: boolean;
  onAdd: (draft: {
    name: string;
    type: ProjectType;
    count: number;
    priority: Priority;
    status: ProjectStatus;
  }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>(allowedTypes[0]);
  const [count, setCount] = useState("1");
  const [priority, setPriority] = useState<Priority>("Med");
  const [status, setStatus] = useState<ProjectStatus>("WISHLIST");
  const [added, setAdded] = useState<string[]>([]);

  function submit() {
    const trimmed = name.trim();
    onAdd({
      name: trimmed,
      type,
      count: Math.max(0, Number.parseInt(count, 10) || 0),
      priority,
      status,
    });
    // Keep type/priority/status — adding three Units in a row almost always
    // means three of the SAME shape, so only the name resets.
    setAdded((a) => [trimmed || `New ${type}`, ...a].slice(0, 5));
    // Clearing the value leaves focus on the field, so the next name can be
    // typed immediately — Input doesn't forward a ref, and none is needed.
    setName("");
  }

  return (
    <div
      className="mt-3 flex flex-col gap-3 rounded-[8px] border border-cyan/30 bg-bg/40 p-3"
      data-walkthrough="sub"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
          <span className="label-osd text-fg-dim">Name</span>
          <Input
            autoFocus
            name="sub-project-name"
            value={name}
            placeholder={`New ${type}`}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-osd text-fg-dim">Type</span>
          <Listbox
            value={type}
            ariaLabel="Sub-project type"
            options={allowedTypes.map((t) => ({ value: t, label: t.toUpperCase() }))}
            onChange={(t) => setType(t)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-osd text-fg-dim">Models</span>
          <Input
            name="sub-project-count"
            type="number"
            min={0}
            value={count}
            disabled={busy}
            onChange={(e) => setCount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-osd text-fg-dim">Priority</span>
          <Listbox
            value={priority}
            ariaLabel="Sub-project priority"
            accent={priorityAccent[priority]}
            options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: p.toUpperCase() }))}
            onChange={(p) => setPriority(p)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-osd text-fg-dim">Status</span>
          <Listbox
            value={status}
            ariaLabel="Sub-project status"
            accent={statusAccent[status]}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            onChange={(s) => setStatus(s)}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="add" size="sm" disabled={busy} onClick={submit}>
          + Add {type.toLowerCase()}
        </Button>
        <Button variant="tertiary" size="sm" onClick={onClose}>
          Done
        </Button>
        {added.length > 0 && (
          <span className="font-body text-body text-fg-dim">
            Added: {added.join(", ")}
          </span>
        )}
      </div>
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
        <span className="min-w-0 flex-1 break-words font-h2 text-h2 text-cyan-lite hover:text-glow-cyan">
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
  glyph?: string;
  label: string;
  value: React.ReactNode;
  /** Optional — omitted where the column is too narrow to spend 22px on it. */
  accent?: "green";
}) {
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      {glyph && (
        <span aria-hidden className={cn("shrink-0", accent === "green" ? "text-green" : "text-cyan-lite")}>
          {glyph}
        </span>
      )}
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

