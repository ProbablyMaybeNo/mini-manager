"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    // HEX.CODE blue welcome card (4:4): blue fill, white text, dismissible,
    // four jump-off CTAs rendered as inset chips on the blue.
    // A11y (Phase 5): the card uses a slightly deeper blue than the --blue token
    // (#2A6FC9 vs #3182E0) so white BODY text clears 4.5:1 (3.89→4.98) — the
    // bright token stays bright everywhere else (links sit on the dark canvas).
    <section
      className="relative overflow-hidden rounded-[12px] p-6 text-white"
      style={{ backgroundColor: "#2A6FC9" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[14px] font-bold tracking-wide text-white">
          &gt; SYS — WELCOME
        </span>
        <button
          type="button"
          aria-label="Dismiss welcome"
          onClick={dismiss}
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-white/70 transition-colors hover:text-white"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <p className="max-w-2xl font-mono text-[14px] leading-relaxed text-white">
        Plan armies, track every model from wishlist to finished, and build
        repeatable paint recipes from a cross-brand paint library.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {/* Inset dark-blue CTA chips on the blue card (4:4). Distinct label from
            the PROJECTS panel's "+ New Project" so e2e selectors stay
            unambiguous; same ?tour=create flow. */}
        <WelcomeCta onClick={() => router.push("/dashboard?tour=create")}>
          CREATE YOUR FIRST PROJECT
        </WelcomeCta>
        <WelcomeCta onClick={() => router.push("/library")}>BROWSE LIBRARY</WelcomeCta>
        <WelcomeCta onClick={() => router.push("/recipes/new")}>BUILD A RECIPE</WelcomeCta>
        <button
          type="button"
          onClick={() => start()}
          className="font-mono text-[12px] font-bold uppercase tracking-wide text-white underline underline-offset-4 transition-opacity hover:opacity-80"
        >
          — TAKE THE TOUR
        </button>
      </div>
    </section>
  );
}

/** Inset dark CTA chip on the blue welcome card. */
function WelcomeCta({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[4px] bg-black/30 px-4 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-black/45"
    >
      {children}
    </button>
  );
}
