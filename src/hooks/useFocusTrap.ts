"use client";

import { useEffect, useRef, type RefObject } from "react";

/** The focusable set every modal shell in the app traps within. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Opt-in initial-focus target (R4-3). A shell that wants one specific field
 * focused on open marks it `data-autofocus` — NOT React's `autoFocus`, which
 * this trap would take straight back off it (and used to; see below).
 * `:not([disabled])` mirrors FOCUSABLE: an unfocusable target falls back to the
 * container rather than leaving focus outside the shell.
 */
const AUTOFOCUS = "[data-autofocus]:not([disabled])";

/**
 * Modal focus trap, extracted from SlideOutPanel so every modal shell (the
 * slide-out, the mobile ProjectBottomSheet, ModalDialog) shares one
 * implementation (a11y plan §4). While `enabled`:
 *   - focus moves into the container on activation — onto `[data-autofocus]`
 *     if the shell marks one, otherwise onto the container itself — and
 *     returns to the previously-focused element on teardown,
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

    // R4-2 — what teardown hands focus back to. It must never be a node INSIDE
    // the shell being trapped: that node dies with the shell, and `.focus()` on
    // a detached element silently drops focus to <body>. Measured on the add-
    // paint dialog: Cancel returned a keyboard user to the top of the document.
    //
    // The way that happened is worth naming, because the guard alone does not
    // fix it. React applies `autoFocus` during COMMIT, before effects run — so
    // on a shell with an autofocus field, the "previously focused element" read
    // here was the shell's own input, and the trigger was already lost. Shells
    // therefore mark their initial-focus target `data-autofocus` and nothing
    // moves focus until the line below does, which leaves this read on the
    // trigger where it belongs. The guard is the floor for anything that
    // forgets: it costs a restore, never a wrong one.
    const active = document.activeElement as HTMLElement | null;
    const lastFocused = active && container?.contains(active) ? null : active;

    // R4-3 — honour the shell's initial-focus target, or fall back to the
    // container, which is the state the Tab branch below is written around.
    (container?.querySelector<HTMLElement>(AUTOFOCUS) ?? container)?.focus();

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

      // Focus is on the container itself — where opening puts it unless the
      // shell named a `data-autofocus` target — or has drifted outside.
      // `querySelectorAll` returns DESCENDANTS, so the
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
