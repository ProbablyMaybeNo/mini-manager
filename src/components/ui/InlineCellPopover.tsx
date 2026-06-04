"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";

/** useLayoutEffect warns on the server; fall back to useEffect there so
 *  the SSR render stays quiet (the popover only ever opens client-side). */
const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

interface InlineCellPopoverProps {
  /** Rendered as the click target. Should look like a button — the
   *  popover itself wraps it in a `<button>` so the host doesn't need
   *  to. */
  trigger: ReactNode;
  /** ARIA label for the trigger button. */
  triggerLabel: string;
  /** Optional className applied to the trigger button so callers can
   *  pass `text-left w-full` etc. */
  triggerClassName?: string;
  /** Popover body — rendered when open. */
  children: ReactNode;
  /** Optional handler to fire when popover closes (after option pick
   *  or click-outside). */
  onClose?: () => void;
}

/**
 * R7-1 — InlineCellPopover.
 *
 * A small click-to-toggle popover used by the projects dashboard table
 * for inline cell editing (status / type / priority). Closes on
 * click-outside, Escape, or when the body emits a click on any
 * `data-cell-popover-close` element.
 *
 * UX (2026-06 walkthrough): the dropdown is PORTALLED to <body> and
 * positioned `fixed` against the trigger's bounding box, so it can no
 * longer be clipped by the table's `overflow-x-auto` scroll container
 * (per the CSS spec, a non-visible overflow on one axis forces the other
 * to clip too — which hid these menus inside the row). The menu flips
 * above the trigger when there isn't room below, and tracks scroll /
 * resize while open.
 *
 * Visual style: tightly-cropped frame matching the existing dropdown
 * pattern used in QuickAddBar + WishlistFilters — bordered, padded,
 * mono caps inside.
 */
export function InlineCellPopover({
  trigger,
  triggerLabel,
  triggerClassName,
  children,
  onClose,
}: InlineCellPopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    placement: "below" | "above";
  } | null>(null);

  const close = () => {
    setOpen(false);
    onClose?.();
  };

  // Position the portalled menu against the trigger's viewport rect.
  // Flip above when there isn't room below; clamp within the viewport.
  const reposition = () => {
    const trig = triggerRef.current;
    if (!trig) return;
    const r = trig.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight ?? 0;
    const gap = 4;
    const spaceBelow = window.innerHeight - r.bottom;
    const placement: "below" | "above" =
      menuH > 0 && spaceBelow < menuH + gap && r.top > spaceBelow
        ? "above"
        : "below";
    const top =
      placement === "below" ? r.bottom + gap : r.top - gap - menuH;
    setPos({ left: r.left, top, placement });
  };

  // Measure synchronously after the menu mounts so it never paints in the
  // wrong place for a frame.
  useIsoLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    reposition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onReflow = () => reposition();
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    // capture:true so the table's inner scroll container also re-anchors
    // the menu, not just the window.
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      role="menu"
      aria-label={triggerLabel}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("[data-cell-popover-close]")) {
          close();
        }
      }}
      className="fixed z-50 min-w-[10rem] frame bg-[var(--color-bg-panel)] shadow-xl p-1 space-y-0.5"
      style={{
        // Until the layout-effect measures the trigger, render the menu
        // off-paint (hidden) so it can be sized without flashing in the
        // wrong place. Once positioned it becomes visible.
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? "visible" : "hidden",
        border: "1px solid var(--color-border-strong)",
      }}
    >
      {children}
    </div>
  ) : null;

  return (
    <span className="inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          // P15.2 — the trigger wraps a ~20px pill/strip; the bare button
          // had no min hit-box. `tap-target` floors it at 44px (mobile) /
          // 32px (desktop) without enlarging the inner pill visual, and
          // inline-flex keeps the pill vertically centred in the taller box.
          "tap-target inline-flex items-center cursor-pointer hover:opacity-90 transition-opacity",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      {/* Portal to body so `fixed` escapes the table's overflow clip. The
          initial render (before the layout-effect measures) mounts the
          menu invisibly via pos===null → null, then positions it. */}
      {typeof document !== "undefined" && menu
        ? createPortal(menu, document.body)
        : null}
    </span>
  );
}

/**
 * Helper menu item — used inside <InlineCellPopover> bodies for a
 * consistent typography + active-row hover state. Pass `active` to
 * mark the currently-set value with a cyan tick.
 */
export function InlineCellPopoverItem({
  active,
  children,
  onClick,
  destructive,
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-cell-popover-close
      onClick={onClick}
      className={clsx(
        // P15.2 — py-1 text-2xs landed at ~22px, under the WCAG 2.5.8
        // 24px floor. py-1.5 + min-h clears the floor for the menu rows.
        "w-full text-left px-2 py-1.5 min-h-[28px] flex items-center font-mono text-2xs uppercase tracking-wider transition-colors",
        destructive
          ? "text-[var(--color-red)] hover:bg-[color-mix(in_srgb,var(--color-red)_12%,transparent)]"
          : "text-[var(--color-fg)] hover:bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]",
        active && !destructive && "text-[var(--color-cyan)]",
      )}
      aria-current={active || undefined}
    >
      {active ? <span aria-hidden>▸ </span> : <span aria-hidden>  </span>}
      {children}
    </button>
  );
}
