"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloseButton } from "@/components/kit";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/cn";
import type { Project, ProjectType } from "@/lib/types";
import { ArmyPanelBody } from "./ArmyPanelBody";
import { UnitPanelBody } from "./UnitPanelBody";

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

/** Container types render the Army (roster) body; everything else renders the
 *  Unit (leaf workbench) body. */
const CONTAINER_TYPES: ReadonlySet<ProjectType> = new Set(["Army", "Warband"]);

/**
 * Phase-2 project FLOW panel — a 440px right-side overlay (full-width sheet on
 * mobile) that opens when a project row is clicked WITHOUT navigating away.
 *
 * It owns a small drill stack: the opened project is the root; drilling a unit
 * pushes it, the unit panel's ‹ breadcrumb pops it. Containers (Army/Warband)
 * render the ArmyPanelBody roster; leaves render the UnitPanelBody workbench.
 * Both bodies carry their own header + sticky GO PAINT footer (Figma 43:4/44:4),
 * so this shell is intentionally chrome-light: just a scrim, focus trap, and a
 * top-right close button.
 *
 * "Expand ⤢ / open full page" routes to /projects/[id] for the roomy editor.
 */
export function ProjectFlowPanel({
  projects,
  rootId,
  projectMinutes = {},
  open,
  onClose,
  onGoPaint,
  onAttachRecipe,
}: {
  projects: Project[];
  rootId: string | null;
  projectMinutes?: Record<string, number>;
  open: boolean;
  onClose: () => void;
  onGoPaint: (project: Project) => void;
  onAttachRecipe?: (project: Project) => void;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [stack, setStack] = useState<string[]>([]);

  // A fresh root resets the drill stack.
  useEffect(() => {
    if (rootId) setStack([rootId]);
  }, [rootId]);

  useFocusTrap(panelRef, open && rootId != null, onClose);

  const activeId = stack[stack.length - 1] ?? rootId;
  const active = activeId ? findProject(projects, activeId) : null;
  const rootProject = rootId ? findProject(projects, rootId) : null;

  function drill(unit: Project) {
    setStack((prev) => (prev.includes(unit.id) ? prev : [...prev, unit.id]));
  }
  function back() {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  function expand(p: Project) {
    onClose();
    router.push(`/projects/${p.id}`);
  }

  if (!open || rootId == null) return null;

  const isContainer = active != null && CONTAINER_TYPES.has(active.type);
  const breadcrumbLabel = rootProject?.title ?? "Back";

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60 motion-safe:animate-scrim-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={active?.title ?? "Project"}
        tabIndex={-1}
        className={cn(
          "absolute right-0 top-0 flex h-full w-full flex-col border-l border-border bg-surface shadow-[-18px_0_50px_-18px_rgba(0,0,0,0.9)] outline-none sm:w-[440px]",
          "motion-safe:animate-panel-in-right",
        )}
      >
        {/* Chrome-light close button overlaid top-right — the body owns the title. */}
        <CloseButton
          onClick={onClose}
          aria-label="Close project panel"
          className="absolute right-2 top-2 z-10 h-9 w-9"
        />
        <div className="flex min-h-0 flex-1 flex-col px-4 py-4 md:px-6 md:py-6">
          {active == null ? (
            <p className="font-mono text-body text-fg-dim">▸ Loading project…</p>
          ) : isContainer ? (
            <ArmyPanelBody
              key={active.id}
              project={active}
              projectMinutes={projectMinutes}
              onDrill={drill}
              onGoPaint={(_army, nextUnit) => onGoPaint(nextUnit ?? active)}
              onExpand={expand}
            />
          ) : (
            <UnitPanelBody
              key={active.id}
              project={active}
              backLabel={stack.length > 1 ? breadcrumbLabel : undefined}
              onBack={stack.length > 1 ? back : undefined}
              onAttachRecipe={onAttachRecipe}
              onCreateRecipe={onAttachRecipe}
              onGoPaint={onGoPaint}
              onExpand={expand}
            />
          )}
        </div>
      </div>
    </div>
  );
}
