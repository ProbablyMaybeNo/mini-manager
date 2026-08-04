"use client";

import { useEffect, type RefObject } from "react";

/** Same focusable set the ModalDialog / SlideOutPanel trap uses. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The focus half of "modal", for a coach-mark card (R3-1).
 *
 * The tour and the first-create walkthrough both declared `aria-modal="true"`
 * and neither trapped focus: a real Tab keypress walked straight out of the
 * card and into the page behind — the page the attribute had just told
 * assistive technology was inert. A keyboard or screen-reader user could roam
 * the background and might never reach the card's own Skip / Back / Next.
 *
 * `useFocusTrap` (SlideOutPanel, ProjectBottomSheet, ModalDialog) is the
 * reference, but it can't be reused verbatim here. It arms once, off a single
 * `enabled` flag, and captures its container at that moment — correct for a
 * panel whose node lives as long as it is open. A coach mark instead swaps
 * card content on every step and only becomes real once it has been measured
 * and placed, so the trap has to re-arm per step.
 *
 * Esc stays with the caller: both overlays already run Esc as one case of
 * their own key script (Esc / ← / → / Enter), and splitting it would mean two
 * handlers racing to close the same thing.
 *
 * @param cardRef the dialog card itself (must carry `tabIndex={-1}`)
 * @param step    bump on every step change to re-seat focus on the new card
 * @param ready   false until the card has been measured and is on screen
 */
export function useCoachMarkFocus(
  cardRef: RefObject<HTMLElement | null>,
  step: number,
  ready: boolean,
) {
  // Remember what had focus when the overlay opened and hand it back when it
  // closes — for the tour that's the "Tour" replay button that started it.
  useEffect(() => {
    const lastFocused = document.activeElement as HTMLElement | null;
    return () => lastFocused?.focus();
  }, []);

  // Land on the card as each step appears, so the live content is what a
  // screen reader reads and Tab starts from inside the dialog.
  useEffect(() => {
    if (!ready) return;
    cardRef.current?.focus();
  }, [cardRef, step, ready]);

  useEffect(() => {
    if (!ready) return;

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;

      const focusables = [...card.querySelectorAll<HTMLElement>(FOCUSABLE)];

      // A card with no reachable control (shouldn't happen — every step has
      // Skip/Next) still must not leak focus into the inert page.
      if (focusables.length === 0) {
        e.preventDefault();
        card.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;

      // Focus is on the card itself — where it lands at the start of every
      // step — or outside it (drifted, or the user clicked the page behind).
      // Send it to the near end rather than letting Tab carry on through the
      // background. The `activeEl === card` case is load-bearing and easy to
      // miss: `card.contains(card)` is true, so without it Shift-Tab from a
      // freshly-opened card matched neither end and fell through to the
      // browser's own order, which walks BACKWARD out of the dialog — verified
      // escaping to a "+ ADD DATE" button behind the tour.
      if (!activeEl || activeEl === card || !card.contains(activeEl)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      // Inside the card: wrap at the ends. Anything in between is the
      // browser's own order, which is already correct.
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cardRef, ready]);
}
