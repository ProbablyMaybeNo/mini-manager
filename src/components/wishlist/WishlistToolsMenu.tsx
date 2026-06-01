"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

interface Props {
  /** Paint title — passed through as the `name` query param so the
   *  destination tool can pre-populate its search input. */
  paintTitle: string;
}

/**
 * P12.13 — Per-paint-row "Tools ▾" affordance on /wishlist.
 *
 * Drops a small menu next to the row's status pill. Menu items:
 *   - Wheel    → /tools/wheel?name=<paint title>
 *   - Match    → /tools/match?name=<paint title>
 *   - Layering → /tools/gradient?name=<paint title>
 *
 * The destination tools accept the `name` query param + use it to
 * pre-populate their search input. This shortcut + paint-name carry-
 * over keeps the painter's "I picked Mephiston Red here, now help me
 * design with it" intent in one click.
 *
 * The button uses variant="ghost" so the row's existing status pill
 * remains the visual anchor — Tools is a secondary affordance.
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
        Tools ▾
      </Button>
      {open ? (
        <div
          role="menu"
          aria-label="Paint tools"
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
