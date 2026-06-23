"use client";

import { useEffect, useState } from "react";
import { SlideOutPanel } from "@/components/kit";
import { cn } from "@/lib/cn";
import { rollupProjectMinutes } from "@/lib/projectTime";
import type { Project } from "@/lib/types";
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

  return (
    <SlideOutPanel
      open={open && tabIds.length > 0}
      onClose={onClose}
      breadcrumb="DASHBOARD ▸ PROJECT"
      title={active?.title ?? ""}
      width="max-w-2xl"
    >
      {tabs.length > 1 && (
        <div className="-mt-1 mb-4 flex flex-wrap gap-1 border-b border-cyan/20 pb-2">
          {tabs.map((t, i) => (
            <span
              key={t.id}
              className={cn(
                "flex items-center border px-2 py-1",
                t.id === activeId
                  ? "border-cyan bg-cyan/10 text-cyan"
                  : "border-cyan/20 text-fg-dim hover:border-cyan/50",
              )}
            >
              <button
                type="button"
                onClick={() => setActiveId(t.id)}
                className="max-w-[10rem] truncate font-body text-body"
              >
                {t.title}
              </button>
              {i > 0 && (
                <button
                  type="button"
                  aria-label={`Close ${t.title} tab`}
                  onClick={() => closeTab(t.id)}
                  className="ml-2 text-fg-dim hover:text-red"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {active ? (
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
      ) : (
        <p className="font-body text-body text-fg-dim">▸ Loading project…</p>
      )}
    </SlideOutPanel>
  );
}
