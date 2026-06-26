"use client";

import { useEffect, useRef, useState } from "react";
import { SlideOutPanel } from "@/components/kit";
import { cn } from "@/lib/cn";
import { useIsDesktop } from "@/hooks/useBreakpoint";
import { rollupProjectMinutes } from "@/lib/projectTime";
import type { Project } from "@/lib/types";
import { InspectorPane } from "./InspectorPane";
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
 */
export function ProjectPanelStack({
  projects,
  rootId,
  projectMinutes = {},
  open,
  onClose,
  onStartSession,
  onAttachRecipe,
}: {
  projects: Project[];
  /** The project that opened the panel — the bottom (un-closable) tab. */
  rootId: string | null;
  projectMinutes?: Record<string, number>;
  open: boolean;
  onClose: () => void;
  onStartSession: (project: Project) => void;
  onAttachRecipe: (project: Project) => void;
}) {
  const [tabIds, setTabIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Roving tabindex: only the active tab is in the Tab order; ArrowLeft/Right
  // move focus (and selection) between tabs. Refs let us move DOM focus to the
  // newly-selected tab on arrow nav (WAI-ARIA tabs pattern).
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // A fresh root resets the stack to a single tab.
  useEffect(() => {
    if (rootId) {
      setTabIds([rootId]);
      setActiveId(rootId);
    }
  }, [rootId]);

  function openSub(id: string) {
    setTabIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveId(id);
  }

  function closeTab(id: string) {
    setTabIds((prev) => {
      if (id === prev[0]) {
        onClose();
        return prev;
      }
      const next = prev.filter((t) => t !== id);
      if (id === activeId) setActiveId(next[next.length - 1] ?? prev[0]);
      return next;
    });
  }

  const active = activeId ? findProject(projects, activeId) : null;
  const tabs = tabIds
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
    setActiveId(target.id);
    tabRefs.current.get(target.id)?.focus();
  }

  const isDesktop = useIsDesktop();
  const visible = open && tabIds.length > 0;

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
                ? "border-cyan border-b-cyan bg-cyan/10 text-cyan"
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
              onClick={() => setActiveId(t.id)}
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
                onClick={() => closeTab(t.id)}
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
        breadcrumb="DASHBOARD ▸ PROJECT"
        onClose={onClose}
      >
        {tabStrip}
        {body}
      </InspectorPane>
    );
  }

  // Mobile (< md): the overlay slide-out (the capstone swaps in the bottom
  // sheet here; SlideOutPanel stays the MobileTopBar nav surface).
  return (
    <SlideOutPanel
      open={visible}
      onClose={onClose}
      breadcrumb="DASHBOARD ▸ PROJECT"
      title={active?.title ?? ""}
      width="max-w-2xl"
    >
      {tabStrip}
      {body}
    </SlideOutPanel>
  );
}
