"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Modal focus trap, extracted from SlideOutPanel so every modal shell (the
 * slide-out + the mobile ProjectBottomSheet) shares one implementation
 * (a11y plan §4). While `enabled`:
 *   - focus moves into the container on activation, and returns to the
 *     previously-focused element on teardown,
 *   - Tab / Shift-Tab cycle within the container,
 *   - Escape calls `onClose`.
 *
 * `onClose` is read through a ref internally so callers can pass a fresh inline
 * handler each render without tearing the trap down (MM-24): re-running the
 * effect on every keystroke inside the panel would steal focus from inputs.
 * Therefore the effect intentionally depends only on `[enabled]`.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const container = ref.current;
    const lastFocused = document.activeElement as HTMLElement | null;
    container?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !container) return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      lastFocused?.focus();
    };
    // Intentionally only [enabled] — see the MM-24 note above. `ref` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
