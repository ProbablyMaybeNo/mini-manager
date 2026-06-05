"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { attachRecipeToProject } from "@/lib/actions/recipes";
import { Button } from "@/components/ui/Button";
import type { AssignProjectOption } from "@/components/recipes/RecipeActionsBar";

interface Props {
  recipeId: string;
  /** All of the user's (non-archived) projects — the dropdown filters by
   *  name client-side as the painter types. Same data path the recipe
   *  editor's "Assign to project ▾" uses. */
  projects: ReadonlyArray<AssignProjectOption>;
  /** Currently-attached project id so the menu can mark + disable it. */
  currentlyAttachedProjectId?: string | null;
  /** Whether the trigger should stretch (mobile card) or sit inline (table). */
  block?: boolean;
}

/**
 * Item 1 — the /recipes row ASSIGN action. Unlike the recipe-editor
 * header (which navigates to the editor), this opens an inline dropdown
 * of the painter's projects and attaches the recipe in place via
 * attachRecipeToProject — no navigation away from the list. The data
 * path is the shared server action; the dropdown mirrors the
 * RecipeActionsBar menu so the two surfaces feel identical.
 */
export function AssignToProjectMenu({
  recipeId,
  projects,
  currentlyAttachedProjectId,
  block = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleAssign = (projectId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await attachRecipeToProject({ recipeId, projectId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Stay on the list — just refresh so the "Attached to" cell updates.
      setMenuOpen(false);
      router.refresh();
    });
  };

  const filteredProjects = filter.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(filter.trim().toLowerCase()),
      )
    : projects;

  return (
    <div className={clsx("relative", block && "flex-1")} ref={menuRef}>
      <Button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={isPending || projects.length === 0}
        variant="success"
        size="sm"
        className={clsx(block && "w-full")}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={
          projects.length === 0
            ? "Create a project first"
            : "Attach this recipe to one of your projects"
        }
      >
        Assign ▾
      </Button>
      {menuOpen ? (
        <div
          role="menu"
          aria-label="Pick a project"
          className="absolute right-0 top-full mt-1 z-30 w-72 max-h-80 overflow-y-auto frame bg-[var(--color-bg-panel)] shadow-lg"
          style={{ border: "1px solid var(--color-border-strong)" }}
        >
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
            placeholder="Search projects…"
            className="block w-full px-3 py-2 font-mono text-xs bg-[var(--color-bg)]"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          />
          {filteredProjects.length === 0 ? (
            <p className="px-3 py-3 text-2xs font-sans text-[var(--color-fg-muted)] text-center">
              No projects match.
            </p>
          ) : (
            <ul>
              {filteredProjects.map((p) => {
                const isCurrent = p.id === currentlyAttachedProjectId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleAssign(p.id)}
                      disabled={isCurrent || isPending}
                      className={clsx(
                        "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-mono tap-target",
                        isCurrent
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]",
                      )}
                    >
                      <span className="truncate text-[var(--color-fg)]">
                        {p.name}
                      </span>
                      <span className="text-2xs text-[var(--color-fg-muted)] uppercase tracking-wider flex-shrink-0">
                        {isCurrent ? "current" : p.type}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="absolute right-0 top-full mt-1 text-2xs font-mono text-[var(--color-red)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
