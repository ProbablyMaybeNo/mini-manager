"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DeleteProjectModal } from "@/components/projects/DeleteProjectModal";

interface Props {
  projectId: string;
  projectName: string;
  /** Detail page → redirect to /projects after delete; dashboard rows
   *  → stay in place + router.refresh(). */
  redirectToProjectsOnSuccess: boolean;
  /** Lets callers control the trigger label / weight. The dashboard
   *  uses an icon-only variant inside the row's existing popover. */
  label?: string;
  /** When true the trigger renders as a low-emphasis inline button
   *  rather than the full red Button variant. */
  inline?: boolean;
}

/**
 * P13.3 — Client trigger that opens DeleteProjectModal. Lives in its
 * own file so the project detail server component can render the
 * trigger without going client-tree itself, and so the dashboard
 * table can render N triggers cheaply.
 */
export function DeleteProjectButton({
  projectId,
  projectName,
  redirectToProjectsOnSuccess,
  label = "Delete project",
  inline = false,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {inline ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-2xs font-mono uppercase tracking-wider text-[var(--color-red)] hover:underline tap-target"
        >
          {label}
        </button>
      ) : (
        // UX-1310 — the solid-red fill over-corrected: it was the single
        // loudest element on the detail page, pulling the eye to the
        // hazard above the project's actual task. Drop to the red OUTLINE
        // tone (red text + border, transparent fill) so it still reads as
        // destructive but no longer dominates. The solid-red fill is
        // reserved for the confirm modal's final "Delete forever".
        <Button
          type="button"
          variant="danger"
          tone="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
      )}
      <DeleteProjectModal
        open={open}
        onClose={() => setOpen(false)}
        projectId={projectId}
        projectName={projectName}
        redirectToProjectsOnSuccess={redirectToProjectsOnSuccess}
      />
    </>
  );
}
