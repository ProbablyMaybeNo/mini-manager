"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  countProjectDescendants,
  deleteProject,
} from "@/lib/actions/projects";
import { Button } from "@/components/ui/Button";
import { LogTag } from "@/components/ui/LogTag";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  /**
   * When called from the project detail page we redirect to /projects
   * on success; when called from the dashboard table we stay put and
   * router.refresh(). The caller picks which behaviour applies.
   */
  redirectToProjectsOnSuccess: boolean;
}

/**
 * P13.3 — Confirm modal for deleting a project + every descendant.
 *
 * The prompt reads "Delete <name> and N sub-projects?". On open we
 * fetch the descendant count via a server action so the painter sees
 * exactly how much will disappear before they confirm. Empty trees
 * still get a confirm step (this isn't undoable).
 *
 * The destructive button uses the new P13.1 `variant="danger"` solid-
 * red filled style with black text — high WCAG contrast, matches the
 * rest of the post-P13.1 button discipline.
 */
export function DeleteProjectModal({
  open,
  onClose,
  projectId,
  projectName,
  redirectToProjectsOnSuccess,
}: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [descendantCount, setDescendantCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sync the native <dialog> with the parent's `open` boolean.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Reset state when closed; fetch the descendant count when opened.
  useEffect(() => {
    if (!open) {
      setDescendantCount(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setDescendantCount(null);
    void countProjectDescendants({ id: projectId }).then((res) => {
      if (cancelled) return;
      if (res.ok) setDescendantCount(res.data.count);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteProject({ id: projectId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      if (redirectToProjectsOnSuccess) {
        router.push("/projects");
      } else {
        router.refresh();
      }
    });
  };

  // Prompt copy — fetched count drives the "and N sub-projects" tail.
  const subProjectsTail =
    descendantCount === null
      ? "and its sub-projects"
      : descendantCount === 0
        ? "(no sub-projects to remove)"
        : `and ${descendantCount} sub-project${descendantCount === 1 ? "" : "s"}`;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label="Delete project"
      className="frame-strong p-0 bg-[var(--color-bg-panel)] text-[var(--color-fg)] backdrop:bg-black/70 m-auto inset-0 w-[440px] max-w-[92vw]"
    >
      <header className="border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
        <p className="text-sm font-mono uppercase tracking-wider text-[var(--color-red)]">
          Delete project
        </p>
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="text-xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-2 disabled:opacity-40"
          aria-label="Cancel"
        >
          ×
        </button>
      </header>

      <div className="p-4 space-y-3">
        <p className="text-sm font-sans text-[var(--color-fg)] leading-snug">
          Delete{" "}
          <strong className="font-mono text-[var(--color-fg)]">
            {projectName}
          </strong>{" "}
          {subProjectsTail}?
        </p>
        <p className="text-2xs font-mono text-[var(--color-fg-muted)] leading-snug">
          The project + every nested child is removed. Attached recipes
          stay in your library — they detach from this project but
          don&apos;t get deleted. This action cannot be undone.
        </p>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 text-xs font-mono text-[var(--color-red)]"
          >
            <LogTag variant="err" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>

      <footer className="flex items-center justify-end gap-2 p-4 border-t border-[var(--color-border)]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={handleConfirm}
          disabled={isPending}
        >
          {isPending ? "Deleting…" : "Delete forever"}
        </Button>
      </footer>
    </dialog>
  );
}
