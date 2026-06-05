"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectType } from "@/db/schema";
import { Button } from "@/components/ui/Button";

interface Props {
  /** Parent project — new children deep-link with this as the parent. */
  projectId: string;
  /** Parent type. Only Army / Warband expose this menu (Add unit / Add
   *  model). Units, Models, Terrain + Diorama render nothing — a Unit
   *  can't host a unit/model from its own menu, a Model hosts nothing,
   *  and Terrain is top-level only (containment rules, 2026-06-05). */
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
 * Options by parent type (2026-06-05 containment rules):
 *   - Army / Warband → "Add unit" + "Add model" (both nest under this
 *     project). Terrain is NOT offered here — it's top-level only, added
 *     from the initial /projects/new page.
 *   - Unit / Model / Terrain / Diorama → no add menu (the parent renders
 *     nothing). A Unit can't add a unit or model from inside; a Model is
 *     assigned to a unit from the new-project parent picker, not created
 *     from the unit's menu.
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

  // Only Army / Warband can add children (Unit + Model). Every other
  // parent type renders nothing — the containment rules forbid adding
  // from inside a unit/model, and terrain is top-level only.
  const canAdd = parentType === "Army" || parentType === "Warband";
  if (!canAdd) return null;

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
            Add unit
          </MenuLink>
          <MenuLink
            href={`/projects/new?parent=${projectId}&type=Model`}
            onClick={() => setOpen(false)}
          >
            Add model
          </MenuLink>
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
