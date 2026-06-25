"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel } from "@/components/kit";
import { useTour } from "@/components/tour";

/**
 * Skip-safe welcome MOTD (DOP-006). Catches users who skip or never trigger
 * the first-run auto-tour: a one-line "what this is", a few "start here"
 * jump-offs, and a relaunch into the existing walkthrough. Dismissal persists
 * in localStorage so it stays gone across reloads — a lightweight client flag
 * (separate from the tour's own "seen" gate, so dismissing the card doesn't
 * suppress the tutorial and vice-versa).
 */
const DISMISSED_KEY = "mm.welcomeDismissed";

export function WelcomeCard() {
  const router = useRouter();
  const { start } = useTour();
  // Default hidden, then reveal after reading the flag so the card never
  // flashes for a user who already dismissed it (avoids an SSR/client mismatch
  // — localStorage is client-only).
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(window.localStorage.getItem(DISMISSED_KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  function dismiss() {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private mode / storage disabled — the card just re-shows next load.
    }
  }

  if (!show) return null;

  return (
    <Panel label="SYS ▸ WELCOME" accent="green" cornerTicks className="relative p-4">
      <button
        type="button"
        aria-label="Dismiss welcome"
        onClick={dismiss}
        className="absolute right-2 top-2 inline-flex min-h-11 min-w-11 items-center justify-center text-fg-faint transition-colors hover:text-cyan"
      >
        ✕
      </button>

      <p className="max-w-2xl pr-10 font-body text-body text-fg">
        <span className="text-green text-glow-green">▸ </span>
        Plan armies, track every model from wishlist to finished, and build
        repeatable paint recipes from a cross-brand paint library.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {/* Distinct label from the PROJECTS panel's "+ New Project" so e2e
            create-project selectors stay unambiguous; same ?tour=create flow. */}
        <Button size="sm" onClick={() => router.push("/dashboard?tour=create")}>
          Create your first project
        </Button>
        <Button variant="secondary" size="sm" onClick={() => router.push("/library")}>
          Browse Library
        </Button>
        <Button variant="secondary" size="sm" onClick={() => router.push("/recipes/new")}>
          Build a Recipe
        </Button>
        <Button variant="tertiary" size="sm" onClick={() => start()}>
          ▸ Take the tour
        </Button>
      </div>
    </Panel>
  );
}
