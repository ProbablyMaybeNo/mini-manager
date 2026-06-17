"use client";

import { SlideOutPanel } from "@/components/kit";
import type { Project } from "@/lib/types";
import { ProjectWorkspaceBody } from "./ProjectWorkspaceBody";

/**
 * Project detail inspector — opens from a PROJECTS row. The rich workspace
 * body (meta, recipe, stats, editable sub-projects, notes, reference image)
 * is shared with the full-page `/projects/[id]` view.
 */
export function ProjectInspector({
  project,
  loggedMinutes,
  open,
  onClose,
  onStartSession,
  onAttachRecipe,
}: {
  project: Project | null;
  /** Logged minutes for this project, rolled up over its sub-projects (UX-011). */
  loggedMinutes?: number;
  open: boolean;
  onClose: () => void;
  onStartSession: (project: Project) => void;
  onAttachRecipe: (project: Project) => void;
}) {
  return (
    <SlideOutPanel
      open={open && project != null}
      onClose={onClose}
      breadcrumb="DASHBOARD ▸ PROJECT DETAILS"
      title={project?.title ?? ""}
      width="max-w-2xl"
    >
      {project && (
        <ProjectWorkspaceBody
          key={project.id}
          project={project}
          loggedMinutes={loggedMinutes}
          onAttachRecipe={onAttachRecipe}
          onStartSession={onStartSession}
          onClose={onClose}
          variant="panel"
        />
      )}
    </SlideOutPanel>
  );
}
