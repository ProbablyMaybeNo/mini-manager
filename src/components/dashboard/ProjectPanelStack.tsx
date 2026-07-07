"use client";

import { useEffect, useRef, useState } from "react";
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

  // ---- History/back integration (MOP-004) ----------------------------------
  // We mirror the drill stack into the browser history so OS/browser Back pops
  // one tier (sub-project → parent → closed) and never exits the app. The model:
  //   open       → pushState({ mmInspector: true })
  //   openSub    → pushState({ mmInspector: true, mmSubProject: true })
  //   user close → history.back() per pushed entry (unwinds cleanly)
  //   popstate   → if event.state has no mmInspector, it's a Next router nav —
  //                pass through untouched; otherwise reconcile the UI to the new
  //                depth (pop a tab or close).
  // `pushedDepthRef` tracks how many of OUR entries are live so a full close can
  // unwind them, and `unwindingRef` flags programmatic history.back() calls so
  // the resulting popstate doesn't double-handle.
  const pushedDepthRef = useRef(0);
  // Number of upcoming programmatic popstate events to swallow (a history.go(-n)
  // fires n popstate events). Boolean wouldn't cover multi-level unwind.
  const unwindingRef = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // A fresh root resets the stack to a single tab.
  useEffect(() => {
    if (rootId) {
      setTabIds([rootId]);
      setActiveId(rootId);
    }
  }, [rootId]);

  // Push our base entry when the panel becomes visible; unwind every pushed
  // entry when it closes. Keyed on `visibleForHistory` (open + has a root) so a
  // programmatic unwind doesn't re-trigger it.
  const visibleForHistory = open && rootId != null;
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (visibleForHistory) {
      window.history.pushState({ ...window.history.state, mmInspector: true }, "");
      pushedDepthRef.current = 1;
      return () => {
        // Panel unmounted/closed externally — unwind our entries so the history
        // stack returns to where it was before we opened (clean back behaviour).
        // BUT: if the current entry is no longer ours (mmInspector), the user
        // navigated FORWARD past the inspector (e.g. "⤢ Open full page" →
        // /projects/[id]); unwinding here would bounce them straight back, so
        // skip it and leave the stale entry behind the new page.
        const depth = pushedDepthRef.current;
        pushedDepthRef.current = 0;
        if (depth > 0 && window.history.state?.mmInspector) {
          unwindingRef.current += depth;
          window.history.go(-depth);
        }
      };
    }
  }, [visibleForHistory]);

  // popstate: OS/browser/predictive Back. Reconcile UI to the popped state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onPop(event: PopStateEvent) {
      // A programmatic unwind (clean close) — swallow; UI already updated.
      if (unwindingRef.current > 0) {
        unwindingRef.current -= 1;
        return;
      }
      // CRITICAL: not our state → a Next.js router navigation. Pass through.
      if (!event.state?.mmInspector) {
        // If our panel is still open, the user backed out past it entirely —
        // close it without touching history (the nav already moved us).
        if (pushedDepthRef.current > 0) {
          pushedDepthRef.current = 0;
          onCloseRef.current();
        }
        return;
      }
      // Our state, with a depth shallower than the stack → Back popped a tier.
      if (!event.state.mmSubProject) {
        // Back to the root inspector entry: drop every pushed sub-tab.
        pushedDepthRef.current = 1;
        setTabIds((prev) => {
          const root = prev[0];
          setActiveId(root ?? null);
          return root ? [root] : prev;
        });
      } else {
        // Still within the sub-stack — pop the top sub-tab.
        pushedDepthRef.current = Math.max(1, pushedDepthRef.current - 1);
        setTabIds((prev) => {
          if (prev.length <= 1) return prev;
          const next = prev.slice(0, -1);
          setActiveId(next[next.length - 1] ?? prev[0]);
          return next;
        });
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function openSub(id: string) {
    setTabIds((prev) => {
      if (prev.includes(id)) return prev;
      // Push a sub-tier history entry so Back pops just this tab (MOP-004).
      if (typeof window !== "undefined") {
        window.history.pushState(
          { ...window.history.state, mmInspector: true, mmSubProject: true },
          "",
        );
        pushedDepthRef.current += 1;
      }
      return [...prev, id];
    });
    setActiveId(id);
  }

  function closeTab(id: string) {
    if (id === tabIds[0]) {
      // Closing the root closes the whole panel — let the close effect unwind
      // history. onClose flips `open`, unmounting via the cleanup above.
      onClose();
      return;
    }
    const isTop = id === tabIds[tabIds.length - 1];
    if (isTop && typeof window !== "undefined" && pushedDepthRef.current > 1) {
      // Closing the top sub-tab is exactly an OS-Back: pop one tier and let
      // popstate update the stack (single source of truth, MOP-004).
      window.history.back();
      return;
    }
    // Closing a non-top middle tab (rare): mutate that specific tab directly and
    // consume one history entry via a guarded back so depth stays balanced.
    setTabIds((prev) => {
      const next = prev.filter((t) => t !== id);
      if (id === activeId) setActiveId(next[next.length - 1] ?? prev[0]);
      return next;
    });
    if (typeof window !== "undefined" && pushedDepthRef.current > 1) {
      pushedDepthRef.current -= 1;
      unwindingRef.current += 1;
      window.history.back();
    }
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

  // Breadcrumb depth (MOP-004): one ▸ PROJECT for the root, then ▸ SUB per tier
  // down to the active tab so the painter can see how deep the drill is.
  const activeIndex = activeId ? Math.max(0, tabIds.indexOf(activeId)) : 0;
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
