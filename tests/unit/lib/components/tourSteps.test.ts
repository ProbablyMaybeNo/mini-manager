import { describe, expect, test } from "vitest";
import { TOUR_STEPS, type TourAnchor } from "@/components/tour/steps";

/**
 * Contract tests for the first-run walkthrough script. The overlay trusts
 * this config blindly (it spotlights `step.target`, renders the step counter
 * off the array length, and treats the `isFinal` step as the create-project
 * CTA), so a malformed step would silently break the tour. These guard the
 * invariants the runtime depends on without rendering the DOM.
 */
describe("TOUR_STEPS", () => {
  test("walks the six core surfaces plus projects + create", () => {
    // Six features named in the brief, all anchored to a live element.
    expect(TOUR_STEPS.length).toBe(8);
  });

  test("every step has a non-empty title, what, and why", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.what.trim().length).toBeGreaterThan(0);
      expect(step.why.trim().length).toBeGreaterThan(0);
    }
  });

  test("step ids are unique (used as React keys)", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every step targets a distinct anchor", () => {
    const targets = TOUR_STEPS.map((s) => s.target);
    expect(new Set(targets).size).toBe(targets.length);
  });

  test("covers each of the six core navigation surfaces", () => {
    const navAnchors: TourAnchor[] = [
      "nav-dashboard",
      "nav-library",
      "nav-collection",
      "nav-recipe",
      "nav-focus",
      "nav-tools",
    ];
    const targets = new Set(TOUR_STEPS.map((s) => s.target));
    for (const anchor of navAnchors) {
      expect(targets.has(anchor)).toBe(true);
    }
  });

  test("exactly one final step, and it is the last + the create CTA", () => {
    const finals = TOUR_STEPS.filter((s) => s.isFinal);
    expect(finals.length).toBe(1);
    const last = TOUR_STEPS[TOUR_STEPS.length - 1];
    expect(last.isFinal).toBe(true);
    expect(last.target).toBe<TourAnchor>("dashboard-new-project");
  });
});
