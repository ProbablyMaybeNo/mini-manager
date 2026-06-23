/**
 * The first-run walkthrough script.
 *
 * Each step anchors to a live UI element via a `data-tour="<id>"` attribute
 * (see `target`). The overlay spotlights that element, positions a tooltip
 * card next to it, and shows the step's WHAT (one-line orientation) + WHY
 * (the payoff). Steps are walked in array order.
 *
 * Adding/removing a step here is the only change needed to reshape the tour,
 * provided the matching `data-tour` anchor exists somewhere in the rendered
 * tree (a step whose anchor is missing is centred as a modal card so the tour
 * never dead-ends).
 */

/** Anchor ids — the `data-tour` attribute value placed on the target element. */
export type TourAnchor =
  | "nav-dashboard"
  | "nav-library"
  | "nav-collection"
  | "nav-recipe"
  | "nav-focus"
  | "nav-tools"
  | "dashboard-projects"
  | "dashboard-new-project";

/** Preferred placement of the tooltip card relative to its target. The
 *  overlay flips/clamps this to stay on-screen, so it's a hint, not a law. */
export type TourPlacement = "top" | "bottom" | "left" | "right";

export interface TourStep {
  /** Stable key (used for React keys + the step counter). */
  id: string;
  /** `data-tour` value of the element this step highlights. */
  target: TourAnchor;
  /** Short heading rendered in the card's tech-label slot. */
  title: string;
  /** One line: what this surface IS. */
  what: string;
  /** One line: why the painter cares / the payoff. */
  why: string;
  /** Preferred tooltip side. Defaults to "right" when omitted. */
  placement?: TourPlacement;
  /**
   * Final step only: instead of "Next", the primary button reads as a CTA
   * that finishes the tour AND fires the create-project flow.
   */
  isFinal?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard",
    target: "nav-dashboard",
    title: "DASHBOARD",
    what: "Your command center — every project, deadline, and painting session at a glance.",
    why: "Start here each day to see what's in progress and what's next.",
    placement: "right",
  },
  {
    id: "library",
    target: "nav-library",
    title: "LIBRARY",
    what: "Browse the full paint catalog and mark which pots you own or want.",
    why: "Assign real paints to your schemes so a recipe is a shopping list you can actually buy.",
    placement: "right",
  },
  {
    id: "collection",
    target: "nav-collection",
    title: "COLLECTION",
    what: "Track the paints and models you own — plus a wishlist for the ones you don't.",
    why: "Never buy a duplicate pot or forget what's still on the sprue.",
    placement: "right",
  },
  {
    id: "recipe",
    target: "nav-recipe",
    title: "RECIPES",
    what: "Build a colour scheme as an ordered list of layers, each pinned to a paint.",
    why: "Save a scheme once, then repeat it across a whole army with zero guesswork.",
    placement: "right",
  },
  {
    id: "focus",
    target: "nav-focus",
    title: "FOCUS BENCH",
    what: "A distraction-free, paint-along view of one recipe with a session stopwatch.",
    why: "Sit at the desk, tick off layers as you go, and log the hours you put in.",
    placement: "right",
  },
  {
    id: "tools",
    target: "nav-tools",
    title: "COLOUR TOOLS",
    what: "A colour wheel, paint matcher, eyedropper, and layer-stacking previewer.",
    why: "Find the closest pot to any colour and plan highlights before you commit a brush.",
    placement: "right",
  },
  {
    id: "projects",
    target: "dashboard-projects",
    title: "YOUR PROJECTS",
    what: "Every army, warband, and model lives in this table with its paint progress.",
    why: "Watch a project move from grey plastic to fully based without losing track.",
    placement: "top",
  },
  {
    id: "create",
    target: "dashboard-new-project",
    title: "GET PAINTING",
    what: "Create your first project to unlock the rest of the workflow.",
    why: "Name an army, set a model count, and you're ready to assign recipes and log sessions.",
    placement: "top",
    isFinal: true,
  },
];
