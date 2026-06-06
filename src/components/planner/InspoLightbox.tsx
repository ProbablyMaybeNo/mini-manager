"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";

/**
 * Focus-polish — INSPO lightbox overlay.
 *
 * A painter double-clicks a thumbnail in the {@link InspoGalleryGrid}
 * and the chosen reference opens here at full size, centered over a
 * dimmed backdrop. Closing rules (Ross's brief):
 *   - clicking the backdrop (anywhere outside the image) closes it
 *   - Esc closes it
 *
 * Accessibility contract:
 *   - SSR-safe: portals to `document.body` only after mount, so the
 *     server render emits nothing (no `document` access during SSR).
 *   - `role="dialog"` + `aria-modal` + a labelled close affordance.
 *   - Focus is trapped inside the overlay while open and restored to
 *     the previously-focused element (the thumbnail) on close.
 *   - Body scroll is locked while open and released on unmount.
 *
 * Render contract: the parent only mounts this when an image is
 * selected, so `src` is always present — there is no internal open
 * flag. Unmount === closed (effects clean up on unmount).
 */
interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

export function InspoLightbox({ src, alt, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // SSR-safe portal — render nothing on the server / first client pass,
  // attach to document.body after mount (mirrors SendToRecipeModal).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Esc-to-close + focus-trap. Tab / Shift+Tab cycle within the
  // overlay's focusables so keyboard users can't escape behind the
  // backdrop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = containerRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Scroll-lock the body while open; restore the prior overflow on
  // unmount. Also move focus to the close button on open and restore it
  // to whatever held focus before (the double-clicked thumbnail).
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  if (!mounted) return null;

  const overlay = (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className={clsx(
        "fixed inset-0 z-[200] flex items-center justify-center p-4",
        "bg-black/80",
      )}
      // Backdrop click closes — only when the click landed on the
      // backdrop itself, not on the image / close button that bubble up.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close image"
        className={clsx(
          "absolute top-3 right-3 tap-target inline-flex items-center justify-center",
          "font-mono text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)]",
          "frame bg-[var(--color-bg-panel)] px-2",
        )}
      >
        ×
      </button>
      {/* Clicks on the image itself must NOT close — only true backdrop
          clicks. The image sits above the backdrop so its own clicks
          don't reach the backdrop handler. */}
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        className={clsx(
          "frame max-w-[92vw] max-h-[88vh] object-contain",
          "bg-[var(--color-bg-panel)]",
        )}
      />
    </div>
  );

  return createPortal(overlay, document.body);
}
