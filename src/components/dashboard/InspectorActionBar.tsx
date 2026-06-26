"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/kit";
import { cn } from "@/lib/cn";

/**
 * The inspector's sticky action bar (MOP-002).
 *
 * Focus stays the prominent, thumb-rest primary; the destructive + secondary
 * lifecycle verbs (Open full page, Archive, Duplicate, Delete) are demoted into
 * a `⋯` overflow menu so the destructive `Delete` leaves the resting zone and
 * can't be fat-fingered. `Delete` still routes through the caller's
 * ConfirmDialog (the `onDelete` handler opens it) — this bar never deletes
 * directly.
 *
 * Rendered `sticky bottom-0` inside the scrollable inspector body so it pins to
 * the bottom on long projects while staying in normal flow (shared by the
 * mobile sheet and the desktop pane).
 */
export interface InspectorOverflowAction {
  key: string;
  label: string;
  onClick: () => void;
  /** Destructive verbs render in red and sit last in the menu. */
  tone?: "default" | "danger";
  /** Hidden below md (e.g. "Open full page", which is desktop-only). */
  desktopOnly?: boolean;
  disabled?: boolean;
}

export function InspectorActionBar({
  onFocus,
  actions,
  disabled = false,
}: {
  /** The prominent primary — opens the focus bench for this project. */
  onFocus?: () => void;
  /** Demoted lifecycle verbs, shown in the ⋯ overflow menu. */
  actions: InspectorOverflowAction[];
  disabled?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the menu on outside click + Escape (the menu is a lightweight
  // popover, not a modal — no focus trap, just dismissal).
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex items-center gap-2 border-t border-cyan/40 bg-bg/95 px-4 py-3 backdrop-blur-sm">
      {onFocus && (
        <Button
          size="sm"
          className="min-h-11"
          disabled={disabled}
          onClick={onFocus}
        >
          ▸ Focus
        </Button>
      )}

      <div ref={wrapRef} className="relative ml-auto">
        <Button
          variant="secondary"
          size="sm"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="More project actions"
          className="min-h-11 min-w-11"
          disabled={disabled}
          onClick={() => setMenuOpen((v) => !v)}
        >
          ⋯
        </Button>

        {menuOpen && (
          <div
            role="menu"
            aria-label="More project actions"
            className="absolute bottom-full right-0 z-20 mb-2 flex min-w-44 flex-col border border-cyan/40 bg-bg shadow-[0_0_24px_rgba(0,210,255,0.14)]"
          >
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                role="menuitem"
                disabled={disabled || a.disabled}
                onClick={() => {
                  setMenuOpen(false);
                  a.onClick();
                }}
                className={cn(
                  "flex min-h-11 items-center px-3 py-2 text-left font-body text-body transition-colors disabled:opacity-40",
                  a.desktopOnly && "hidden md:flex",
                  a.tone === "danger"
                    ? "text-red hover:bg-red/10"
                    : "text-fg hover:bg-cyan/10 hover:text-cyan",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
