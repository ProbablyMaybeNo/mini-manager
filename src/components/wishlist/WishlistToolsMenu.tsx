"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

interface Props {
  /** Paint title — passed through as the `name` query param so the
   *  destination tool can pre-populate its search input. */
  paintTitle: string;
}

/**
 * P12.13 — Per-paint-row "Open in ▾" affordance on /wishlist.
 *
 * Drops a small menu next to the row's status pill. Menu items:
 *   - Wheel    → /tools/wheel?name=<paint title>
 *   - Match    → /tools/match?name=<paint title>
 *   - Layering → /tools/gradient?name=<paint title>
 *
 * The destination tools accept the `name` query param + use it to
 * pre-populate their search input. WheelClient additionally accepts
 * `?hex=` as the canonical pre-seed param (R7-004); since wishlist
 * items don't carry a resolved hex, this menu keeps sending `?name=`
 * and the wheel falls back to catalog-resolution on its end.
 *
 * The button uses variant="ghost" so the row's existing status pill
 * remains the visual anchor — Open in is a secondary affordance.
 *
 * R7-010 — label flipped from "Tools ▾" to "Open in ▾" so it doesn't
 * collide with the sidebar Tools page name. The trigger button text
 * + the menu's aria-label both reflect the new vocabulary.
 */
export function WishlistToolsMenu({ paintTitle }: Props) {
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

  const qs = new URLSearchParams({ name: paintTitle }).toString();

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Open this paint in a tool"
      >
        Open in ▾
      </Button>
      {open ? (
        <div
          role="menu"
          aria-label="Open paint in a tool"
          className="absolute right-0 top-full mt-1 z-30 min-w-[140px] frame-strong bg-[var(--color-bg-panel)] shadow-xl py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <MenuLink href={`/tools/wheel?${qs}`} onClick={() => setOpen(false)}>
            Wheel
          </MenuLink>
          <MenuLink href={`/tools/match?${qs}`} onClick={() => setOpen(false)}>
            Match
          </MenuLink>
          <MenuLink
            href={`/tools/gradient?${qs}`}
            onClick={() => setOpen(false)}
          >
            Layering
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
      className="block px-3 py-1.5 text-xs font-mono text-[var(--color-fg)] hover:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)] hover:text-[var(--color-cyan)]"
    >
      {children}
    </a>
  );
}
