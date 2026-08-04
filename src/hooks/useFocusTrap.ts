"use client";

import { useEffect, useRef, type RefObject } from "react";

/** The focusable set every modal shell in the app traps within. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Modal focus trap, extracted from SlideOutPanel so every modal shell (the
 * slide-out, the mobile ProjectBottomSheet, ModalDialog) shares one
 * implementation (a11y plan §4). While `enabled`:
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
      const focusables = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];

      // A shell with no reachable control (every one of ours has at least a
      // ✕) still must not let Tab walk off into the page behind.
      if (focusables.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;

      // Focus is on the container itself — where opening puts it — or has
      // drifted outside. `querySelectorAll` returns DESCENDANTS, so the
      // container is never in `focusables`: without this branch (R3-5) the
      // freshly-opened state matched neither end and fell through to the
      // browser's own order. Forward landed on `first` by luck, since the
      // container precedes its children; BACKWARD walked out of the dialog
      // into the page it had just declared inert via `aria-modal="true"` —
      // verified escaping to the Primary nav behind a ModalDialog and to the
      // paint grid behind the Library filter panel. Send it to the near end
      // instead. Same reasoning, same shape as useCoachMarkFocus.
      if (!activeEl || activeEl === container || !container.contains(activeEl)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      // Inside: wrap at the ends. Anything in between is the browser's own
      // order, which is already correct.
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
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
