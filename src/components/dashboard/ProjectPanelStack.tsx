"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useIsDesktop } from "@/hooks/useBreakpoint";
import { rollupProjectMinutes } from "@/lib/projectTime";
import type { Project } from "@/lib/types";
import { InspectorPane } from "./InspectorPane";
import { ProjectBottomSheet } from "./ProjectBottomSheet";
import { ProjectWorkspaceBody } from "./ProjectWorkspaceBody";

/** Find a project anywhere in the tree by id (rows + their sub-projects). */
function findProject(list: Project[], id: string): Project | null {
  for (const p of list) {
    if (p.id === id) return p;
    if (p.children) {
      const hit = findProject(p.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * The project detail surface — a slide-out that keeps a STACK of open
 * projects as tabs. Opening a sub-project (or creating / duplicating one)
 * pushes a new tab a tier down; the strip lets the painter click back and
 * forth between related projects without losing their place. The rich body
 * is shared with the full-page `/projects/[id]` view.
 *
 * The stack itself is URL state owned by {@link useInspectorStack} (one history
 * entry per tier, so browser Back pops one tier — MOP-004). This component
 * renders that stack and reports intent; it never touches history itself.
 */
export function ProjectPanelStack({
  projects,
  stack,
  projectMinutes = {},
  onClose,
  onDrill,
  onCloseTier,
  onStartSession,
  onAttachRecipe,
}: {
  projects: Project[];
  /** Open project ids, root first — the root is the un-closable bottom tab. */
  stack: string[];
  projectMinutes?: Record<string, number>;
  onClose: () => void;
  onDrill: (id: string) => void;
  onCloseTier: (index: number) => void;
  onStartSession: (project: Project) => void;
  onAttachRecipe: (project: Project) => void;
}) {
  // Which tab is showing. Purely view state: switching tabs doesn't change the
  // drill, so it is not in the URL. Clamped to the live stack below, which is
  // what makes Back "just work" — pop a tier and the selection falls to the new
  // top without a popstate handler.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Roving tabindex: only the active tab is in the Tab order; ArrowLeft/Right
  // move focus (and selection) between tabs. Refs let us move DOM focus to the
  // newly-selected tab on arrow nav (WAI-ARIA tabs pattern).
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const activeId =
    selectedId && stack.includes(selectedId) ? selectedId : (stack[stack.length - 1] ?? null);

  function openSub(id: string) {
    setSelectedId(id);
    onDrill(id);
  }

  const active = activeId ? findProject(projects, activeId) : null;
  const tabs = stack
    .map((id) => findProject(projects, id))
    .filter((p): p is Project => p != null);

  /** WAI-ARIA tabs keyboard model: Arrow keys move selection + focus, Home/End
   *  jump to the ends. Selection follows focus (automatic activation). */
  function onTabKeyDown(e: React.KeyboardEvent, index: number) {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    const target = tabs[next];
    if (!target) return;
    setSelectedId(target.id);
    tabRefs.current.get(target.id)?.focus();
  }

  const isDesktop = useIsDesktop();
  // Keyed on the URL stack, NOT on whether the projects resolved: a refresh can
  // land a tree that momentarily lacks the open project, and unmounting the
  // panel for that frame throws the painter out of it mid-edit. An unresolved
  // root shows the loading body instead, which is what it did before R2-17.
  const visible = stack.length > 0;

  // Breadcrumb depth (MOP-004): one ▸ PROJECT for the root, then ▸ SUB per tier
  // down to the active tab so the painter can see how deep the drill is.
  const activeIndex = activeId ? Math.max(0, stack.indexOf(activeId)) : 0;
  const breadcrumb =
    "PROJECTS ▸ PROJECT" + " ▸ SUB".repeat(activeIndex);

  const body = active ? (
    // When the tab strip is showing, the body is the tabs' panel — labelled
    // by the active tab so SR users hear which project they're in (MUX-006).
    tabs.length > 1 ? (
      <div
        role="tabpanel"
        id="subproject-tabpanel"
        aria-labelledby={`subproject-tab-${active.id}`}
        tabIndex={0}
        className="focus:outline-none"
      >
        <ProjectWorkspaceBody
          key={active.id}
          project={active}
          loggedMinutes={rollupProjectMinutes(active, projectMinutes)}
          onAttachRecipe={onAttachRecipe}
          onStartSession={onStartSession}
          onOpenSubProject={openSub}
          onClose={onClose}
          variant="panel"
        />
      </div>
    ) : (
      <ProjectWorkspaceBody
        key={active.id}
        project={active}
        loggedMinutes={rollupProjectMinutes(active, projectMinutes)}
        onAttachRecipe={onAttachRecipe}
        onStartSession={onStartSession}
        onOpenSubProject={openSub}
        onClose={onClose}
        variant="panel"
      />
    )
  ) : (
    <p className="font-body text-body text-fg-dim">▸ Loading project…</p>
  );

  const tabStrip = tabs.length > 1 && (
    <div
      role="tablist"
      aria-label="Open projects"
      aria-orientation="horizontal"
      className="-mt-1 mb-4 flex flex-wrap gap-1 border-b border-cyan/20 pb-2"
    >
      {tabs.map((t, i) => {
        const selected = t.id === activeId;
        return (
          <span
            key={t.id}
            className={cn(
              // min-h-11 (44px) gives the label+close cell a thumb-friendly
              // height (MUX-007). border-b-2 + the leading ▸ marker on the
              // active tab are non-colour active cues (MUX-006).
              "flex min-h-11 items-center gap-2 border border-b-2 px-2 py-1",
              selected
                ? "border-cyan border-b-cyan bg-cyan/10 text-cyan-lite"
                : "border-cyan/20 border-b-transparent text-fg-dim hover:border-cyan/50",
            )}
          >
            <button
              type="button"
              role="tab"
              id={`subproject-tab-${t.id}`}
              aria-selected={selected}
              aria-controls="subproject-tabpanel"
              tabIndex={selected ? 0 : -1}
              ref={(el) => {
                if (el) tabRefs.current.set(t.id, el);
                else tabRefs.current.delete(t.id);
              }}
              onClick={() => setSelectedId(t.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className="flex max-w-[10rem] items-center gap-1 truncate font-body text-body focus:outline-none focus-visible:underline"
            >
              <span aria-hidden className={cn("shrink-0", selected ? "visible" : "invisible")}>
                ▸
              </span>
              <span className="truncate">{t.title}</span>
            </button>
            {i > 0 && (
              <button
                type="button"
                aria-label={`Close ${t.title} tab`}
                onClick={() => onCloseTier(i)}
                // ≥24px hit area, 8px (gap-2) from the label tap area.
                className="flex h-6 w-6 shrink-0 items-center justify-center text-fg-dim hover:text-red focus:outline-none focus-visible:text-red"
              >
                ×
              </button>
            )}
          </span>
        );
      })}
    </div>
  );

  // Desktop (md+): persistent in-flow master-detail pane — no scrim, table
  // stays visible alongside (DOP-002). Mounts only while open; DashboardView
  // places it inside the two-pane flex row.
  if (isDesktop) {
    if (!visible) return null;
    return (
      <InspectorPane
        title={active?.title ?? ""}
        breadcrumb={breadcrumb}
        onClose={onClose}
      >
        {tabStrip}
        {body}
      </InspectorPane>
    );
  }

  // Mobile (< md): the true bottom sheet (capstone). SlideOutPanel stays the
  // MobileTopBar nav surface; the inspector now uses ProjectBottomSheet.
  return (
    <ProjectBottomSheet
      open={visible}
      onClose={onClose}
      breadcrumb={breadcrumb}
      title={active?.title ?? ""}
    >
      {tabStrip}
      {body}
    </ProjectBottomSheet>
  );
}
