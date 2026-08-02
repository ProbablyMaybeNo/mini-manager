/**
 * First-create project walkthrough — pure data + gating logic.
 *
 * A small, self-contained coach-mark sequence shown the FIRST time a painter
 * creates a project and lands on the editable project panel. It reuses the
 * tour's visual language (spotlight ring + cyan card) but is deliberately NOT
 * wired into <TourProvider>: that tour is a single global dashboard tour driven
 * by its own DB `seen` flag and auto-starts on dashboard mount. This sequence
 * has a different trigger (the create-draft panel opening) and a different set
 * of targets (controls inside ProjectWorkspaceBody), so a standalone overlay
 * keeps the two from entangling.
 *
 * The "seen" flag lives in localStorage (not the DB) — acceptable for v1 and
 * materially simpler (no migration / server round-trip). It mirrors the tour's
 * own localStorage mirror pattern (see TourProvider's SEEN_KEY).
 *
 * Splitting the steps + the show/hide decision out as pure values here makes
 * them unit-testable without rendering React.
 */

/** Anchor ids — the `data-walkthrough` attribute value on the target element. */
export type WalkthroughAnchor = "name" | "meta" | "sub" | "recipes";

/** Preferred placement of the tooltip card relative to its target. The overlay
 *  flips/clamps this to stay on-screen, so it's a hint, not a law. */
export type WalkthroughPlacement = "top" | "bottom" | "left" | "right";

export interface WalkthroughStep {
  /** Stable key (React key + step counter). */
  id: string;
  /** `data-walkthrough` value of the element this step highlights. */
  target: WalkthroughAnchor;
  /** Short heading rendered in the card's label slot. */
  title: string;
  /** One friendly line pointing at the control. */
  body: string;
  /** Preferred tooltip side. Defaults to "bottom" when omitted. */
  placement?: WalkthroughPlacement;
}

/** The walkthrough script. Order = walk order. */
export const PROJECT_CREATE_WALKTHROUGH: WalkthroughStep[] = [
  {
    id: "name",
    target: "name",
    title: "PROJECT CREATED",
    body: "Now give it a real name — it starts as 'New Project'.",
    placement: "bottom",
  },
  {
    id: "meta",
    target: "meta",
    title: "DEFINE IT",
    body: "Assign a type, set its status, and how urgent it is.",
    placement: "bottom",
  },
  {
    id: "sub",
    target: "sub",
    title: "SUB-PROJECTS",
    body: "Add units under it — each row tracks its own progress.",
    placement: "top",
  },
  {
    id: "recipes",
    target: "recipes",
    title: "RECIPES",
    body: "Attach a paint scheme.",
    placement: "top",
  },
];

/** localStorage key for the "seen the first-create walkthrough" flag. */
export const WALKTHROUGH_SEEN_KEY = "mm.projectCreateWalkthroughSeen";

/**
 * Pure gate: should the first-create walkthrough run right now? Kept free of
 * `window` so it's unit-testable — callers pass the resolved environment in.
 *
 * - `seen`        — has the painter already finished/skipped it (localStorage)?
 * - `isWebdriver` — true under Playwright/E2E; never auto-show there (the
 *                   click-blocking overlay would time out interaction tests),
 *                   matching TourProvider's webdriver guard.
 */
export function shouldShowProjectCreateWalkthrough({
  seen,
  isWebdriver,
}: {
  seen: boolean;
  isWebdriver: boolean;
}): boolean {
  if (isWebdriver) return false;
  return !seen;
}

/** Read the seen flag from localStorage. Safe in private mode / SSR. */
export function hasSeenWalkthrough(): boolean {
  try {
    return window.localStorage.getItem(WALKTHROUGH_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Persist the seen flag. No-op if storage is unavailable. */
export function markWalkthroughSeen(): void {
  try {
    window.localStorage.setItem(WALKTHROUGH_SEEN_KEY, "1");
  } catch {
    // Private mode / storage disabled — worst case it re-shows next session.
  }
}
