"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  attachRecipeToProject,
  detachRecipe,
} from "@/lib/actions/recipes";
import { Button } from "@/components/ui/Button";

export interface AssignProjectOption {
  id: string;
  name: string;
  type: string;
}

interface Props {
  recipeId: string;
  /** Standalone recipes show the Save CTA as "Save" (passive feedback);
   *  attached recipes show "Detach" semantics on the same button so a
   *  painter can lift a recipe back into their library. */
  isStandalone: boolean;
  /** All of the user's projects (top-level + sub-projects) — populated
   *  server-side and passed in. The dropdown filters by name client-
   *  side as the painter types. */
  projects: ReadonlyArray<AssignProjectOption>;
  /** Optional currently-attached project id so the menu can mark it. */
  currentlyAttachedProjectId?: string | null;
}

/**
 * P12.4 — Save vs Assign actions row.
 *
 * The recipe page header gets two clearly distinct CTAs:
 *
 *   Save (green / success variant)
 *     - For an ATTACHED recipe: detaches it back to the standalone
 *       library + bumps "saved!" feedback.
 *     - For a STANDALONE recipe: a no-op confirmation (since edits
 *       auto-save via the header debounce). The button still shows
 *       so the painter has a reassuring "yes I'm in the library"
 *       affordance.
 *
 *   Assign to project ▾ (success / green variant — R7-006)
 *     - Opens an inline searchable dropdown of the user's projects.
 *     - On pick: calls attachRecipeToProject + navigates to the
 *       destination project's page (Ross's locked answer).
 *     - Was primary (cyan) pre-R7. Round-7 audit flipped ATTACH /
 *       ASSIGN actions to green — cyan-on-buttons is now reserved
 *       for auth / sign-in / publish-confirm.
 *
 * Animations gated on prefers-reduced-motion.
 */
export function RecipeActionsBar({
  recipeId,
  isStandalone,
  projects,
  currentlyAttachedProjectId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveFlash, setSaveFlash] = useState<"idle" | "saved">("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the dropdown on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
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

  const handleSave = () => {
    setError(null);
    if (isStandalone) {
      // Already standalone — show a quick "saved" flash so the painter
      // gets visible confirmation. No server call needed (edits auto-
      // save via the inline contentEditable name + step debouncers).
      setSaveFlash("saved");
      window.setTimeout(() => setSaveFlash("idle"), 1500);
      return;
    }
    startTransition(async () => {
      const result = await detachRecipe({ recipeId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaveFlash("saved");
      window.setTimeout(() => setSaveFlash("idle"), 1500);
      // The page revalidates server-side; refresh client to pick up
      // the new isStandalone state.
      router.refresh();
    });
  };

  const handleAssign = (projectId: string) => {
    setError(null);
    setMenuOpen(false);
    startTransition(async () => {
      const result = await attachRecipeToProject({ recipeId, projectId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Ross's locked answer: navigate to the destination project
      // after attach.
      router.push(`/projects/${projectId}`);
    });
  };

  const filteredProjects = filter.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(filter.trim().toLowerCase()),
      )
    : projects;

  return (
    <div className="flex flex-wrap items-center gap-3" role="toolbar" aria-label="Recipe actions">
      <Button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        variant="success"
        size="sm"
        title={
          isStandalone
            ? "Saved in your recipe library"
            : "Save to your recipe library (detach from project)"
        }
      >
        {saveFlash === "saved"
          ? "Saved ✓"
          : isStandalone
            ? "Save"
            : "Save to library"}
      </Button>

      <div className="relative" ref={menuRef}>
        <Button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={isPending || projects.length === 0}
          variant="success"
          size="sm"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={
            projects.length === 0
              ? "Create a project first"
              : "Attach this recipe to one of your projects"
          }
        >
          Assign to project ▾
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
                          "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-mono",
                          isCurrent
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)]",
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
      </div>

      {error ? (
        <p
          role="alert"
          className="text-2xs font-mono text-[var(--color-red)] w-full"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
