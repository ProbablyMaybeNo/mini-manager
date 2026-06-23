"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { completeTutorialAction } from "@/lib/actions/tutorial";
import { TOUR_STEPS } from "./steps";
import { TourOverlay } from "./TourOverlay";

/**
 * localStorage key for the client-side "seen" mirror. The DB column is the
 * source of truth, but writing here too means a hard refresh in the same
 * browser won't re-show the tour even before the server round-trip settles,
 * and it gives anonymous/preview sessions (no user row) a working flag.
 */
const SEEN_KEY = "mm.tutorialSeen";

interface TourContextValue {
  /** Whether the tour is currently running. */
  active: boolean;
  /** Zero-based index of the current step. */
  index: number;
  /** Begin the tour from the top (re-trigger entry point). */
  start: () => void;
  /** Advance to the next step, or finish if on the last one. */
  next: () => void;
  /** Go back a step (no-op on the first). */
  back: () => void;
  /** End the tour and record it as seen. */
  finish: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

/** Read the tour API. Throws if used outside the provider. */
export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within <TourProvider>");
  return ctx;
}

function markSeenLocal() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private mode / storage disabled — the DB flag still covers us.
  }
}

function hasSeenLocal(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function TourProvider({
  children,
  /** First-run gate from the server: true once the DB flag is stamped. When
   *  false (and signed in), the tour auto-starts on first mount. */
  seen,
  /** Only auto-start for a real signed-in session. */
  signedIn = true,
}: {
  children: ReactNode;
  seen: boolean;
  signedIn?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  // Guard so the first-run auto-start fires at most once per mount.
  const autoStartedRef = useRef(false);

  const start = useCallback(() => {
    setIndex(0);
    setActive(true);
  }, []);

  const persistSeen = useCallback(() => {
    markSeenLocal();
    // Fire-and-forget: the UI has already closed; a failed write just means
    // the server re-evaluates `seen` next load (worst case the tour re-shows).
    void completeTutorialAction();
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    persistSeen();
  }, [persistSeen]);

  const next = useCallback(() => {
    setIndex((i) => {
      const last = TOUR_STEPS.length - 1;
      if (i >= last) {
        // Reached the end via Next/Enter — close + record, and run the final
        // step's CTA (open the create-project flow on the dashboard).
        setActive(false);
        persistSeen();
        router.push("/dashboard?tour=create");
        return i;
      }
      return i + 1;
    });
  }, [persistSeen, router]);

  const back = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  // First-run auto-start. Runs once, only when signed in and not yet seen
  // (server flag AND the local mirror). Defer one frame so the anchored
  // elements have mounted before the overlay measures them.
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!signedIn || seen || hasSeenLocal()) return;
    // Never auto-show the tour to an automated browser (Playwright/E2E): its
    // click-blocking overlay would time out every interaction test.
    if (typeof navigator !== "undefined" && navigator.webdriver) return;
    autoStartedRef.current = true;
    const id = window.requestAnimationFrame(() => {
      setIndex(0);
      setActive(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [seen, signedIn]);

  const value = useMemo<TourContextValue>(
    () => ({ active, index, start, next, back, finish }),
    [active, index, start, next, back, finish],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && (
        <TourOverlay
          step={TOUR_STEPS[index]}
          index={index}
          total={TOUR_STEPS.length}
          pathname={pathname}
          onNext={next}
          onBack={back}
          onSkip={finish}
        />
      )}
    </TourContext.Provider>
  );
}
