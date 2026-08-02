import { describe, expect, test } from "vitest";
import {
  PROJECT_CREATE_WALKTHROUGH,
  shouldShowProjectCreateWalkthrough,
  WALKTHROUGH_SEEN_KEY,
  type WalkthroughAnchor,
} from "@/components/dashboard/projectCreateWalkthroughData";

describe("shouldShowProjectCreateWalkthrough — first-create gate", () => {
  test("shows for a first-time, non-webdriver user", () => {
    expect(
      shouldShowProjectCreateWalkthrough({ seen: false, isWebdriver: false }),
    ).toBe(true);
  });

  test("never re-shows once seen", () => {
    expect(
      shouldShowProjectCreateWalkthrough({ seen: true, isWebdriver: false }),
    ).toBe(false);
  });

  test("never auto-shows under an automated browser (E2E)", () => {
    // Even on a fresh (unseen) user, webdriver suppresses the overlay so it
    // can't block Playwright interaction tests.
    expect(
      shouldShowProjectCreateWalkthrough({ seen: false, isWebdriver: true }),
    ).toBe(false);
    expect(
      shouldShowProjectCreateWalkthrough({ seen: true, isWebdriver: true }),
    ).toBe(false);
  });
});

describe("PROJECT_CREATE_WALKTHROUGH — step script integrity", () => {
  // No "progress" step: a brand-new project is a container, and containers
  // don't get a PROGRESS section any more — progress lives on the sub-project
  // rows (Ross, 2026-08-01).
  const EXPECTED_ANCHORS: WalkthroughAnchor[] = ["name", "meta", "sub", "recipes"];

  test("covers exactly the four required controls in order", () => {
    expect(PROJECT_CREATE_WALKTHROUGH.map((s) => s.target)).toEqual(
      EXPECTED_ANCHORS,
    );
  });

  test("every step has tight, non-empty copy", () => {
    for (const step of PROJECT_CREATE_WALKTHROUGH) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.body.trim().length).toBeGreaterThan(0);
      // Keep tooltip copy short — one friendly line.
      expect(step.body.length).toBeLessThanOrEqual(80);
    }
  });

  test("step ids are unique (stable React keys)", () => {
    const ids = PROJECT_CREATE_WALKTHROUGH.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("seen-flag key", () => {
  test("is a stable, namespaced localStorage key", () => {
    expect(WALKTHROUGH_SEEN_KEY).toBe("mm.projectCreateWalkthroughSeen");
  });
});
