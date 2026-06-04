"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectType } from "@/db/schema";
import { Button } from "@/components/ui/Button";
import { childNoun } from "@/lib/progress";

interface Props {
  /** Parent project — new children deep-link with this as the parent. */
  projectId: string;
  /** Parent type — drives which add options are reachable + their labels.
   *  Army / Warband nest Units AND can spawn top-level Terrain; a Unit
   *  nests Models (1-model Units per the P13.4 fold). */
  parentType: ProjectType;
}

/**
 * Item 1 (batch/army-project-page) — the single unified "+ Add" control
 * for a project workspace.
 *
 * v6-4 walkthrough flagged the army page for having multiple redundant
 * add affordances: a "+ Unit" in the header strip, "+ ADD UNIT" /
 * "+ ADD TERRAIN" on the Progress table, and another add button on the
 * sub-projects Card. This menu consolidates every add capability behind
 * one entry point at the top of the page — the only place the painter
 * looks to add anything.
 *
 * Options by parent type:
 *   - Army / Warband → "Add unit" (nests a Unit under this project) +
 *     "Add terrain" (a top-level Terrain Piece — terrain stays leaf-only
 *     per the locked sub-project rule, so it gets no parent).
 *   - Unit           → "Add model" (nests a 1-model Unit sub-project).
 *
 * Mirrors the WishlistToolsMenu pattern (click-away + Escape close,
 * role="menu"). Trigger uses the success variant per the P12.23 button
 * discipline (ADD/CREATE → green). No cyan on the add action.
 */
export function AddChildMenu({ projectId, parentType }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Army / Warband nest Units; a Unit nests Models.
  const childLabel = childNoun(parentType); // "Unit" | "Model"
  // Terrain only makes sense as a top-level sibling under an Army/Warband
  // roster — terrain can't nest, so it's offered without a parent.
  const showTerrain = parentType === "Army" || parentType === "Warband";

  return (
    <div ref={ref} className="relative inline-block ml-auto">
      <Button
        type="button"
        variant="success"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Add to this project"
      >
        + Add ▾
      </Button>
      {open ? (
        <div
          role="menu"
          aria-label="Add to this project"
          className="absolute right-0 top-full mt-1 z-30 min-w-[160px] frame-strong bg-[var(--color-bg-panel)] shadow-xl py-1"
        >
          <MenuLink
            href={`/projects/new?parent=${projectId}&type=Unit`}
            onClick={() => setOpen(false)}
          >
            Add {childLabel.toLowerCase()}
          </MenuLink>
          {showTerrain ? (
            <MenuLink
              href={`/projects/new?type=Terrain Piece`}
              onClick={() => setOpen(false)}
            >
              Add terrain
            </MenuLink>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      role="menuitem"
      onClick={onClick}
      className="block px-3 py-1.5 text-xs font-mono uppercase tracking-wide text-[var(--color-fg)] hover:bg-[color-mix(in_srgb,var(--color-green)_10%,transparent)] hover:text-[var(--color-green)]"
    >
      {children}
    </a>
  );
}
