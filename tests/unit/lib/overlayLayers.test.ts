import { afterEach, describe, expect, test, vi } from "vitest";
import {
  OVERLAY_LAYER_PRIORITY,
  claimOverlayLayer,
  getActiveOverlayLayer,
  getServerOverlayLayer,
  resetOverlayLayers,
  subscribeOverlayLayers,
  topOverlayLayer,
} from "@/lib/overlayLayers";

/**
 * R3-1 — a brand-new account's first action put three overlays on screen at
 * once (tour, first-create walkthrough, PWA install banner), TWO of them
 * asserting `aria-modal="true"` at the same z-index. That attribute means
 * "everything outside me is inert", so two at once is self-contradictory and
 * neither is unambiguously on top.
 *
 * This module is the arbiter: exactly one claimed layer is ever active, and
 * which one is decided by a fixed priority rather than by which component's
 * effect happened to run first — React runs child effects before parent
 * effects, so the walkthrough (deep in the dashboard tree) always claims
 * BEFORE the tour (in the app layout), yet the tour has to win.
 */

afterEach(() => {
  resetOverlayLayers();
});

describe("topOverlayLayer — pure priority resolution", () => {
  test("nothing claimed means nothing is modal", () => {
    expect(topOverlayLayer([])).toBeNull();
  });

  test("a lone claim is the active layer", () => {
    expect(topOverlayLayer(["project-walkthrough"])).toBe("project-walkthrough");
    expect(topOverlayLayer(["tour"])).toBe("tour");
  });

  test("the tour outranks the walkthrough", () => {
    expect(topOverlayLayer(["tour", "project-walkthrough"])).toBe("tour");
  });

  test("the winner does not depend on claim order", () => {
    // The order-independence IS the fix: the losing overlay must render
    // nothing regardless of which effect fired first.
    expect(topOverlayLayer(["project-walkthrough", "tour"])).toBe("tour");
    expect(topOverlayLayer(["tour", "project-walkthrough"])).toBe("tour");
  });

  test("priority list has no duplicates and covers both layers", () => {
    expect(new Set(OVERLAY_LAYER_PRIORITY).size).toBe(
      OVERLAY_LAYER_PRIORITY.length,
    );
    expect([...OVERLAY_LAYER_PRIORITY].sort()).toEqual([
      "project-walkthrough",
      "tour",
    ]);
  });
});

describe("claim store — at most one active layer", () => {
  test("starts idle", () => {
    expect(getActiveOverlayLayer()).toBeNull();
  });

  test("claiming activates that layer", () => {
    claimOverlayLayer("project-walkthrough");
    expect(getActiveOverlayLayer()).toBe("project-walkthrough");
  });

  test("a higher-priority claim takes over even when it arrives second", () => {
    claimOverlayLayer("project-walkthrough");
    claimOverlayLayer("tour");
    expect(getActiveOverlayLayer()).toBe("tour");
  });

  test("releasing the winner hands the screen to the layer still waiting", () => {
    claimOverlayLayer("project-walkthrough");
    const releaseTour = claimOverlayLayer("tour");
    expect(getActiveOverlayLayer()).toBe("tour");
    // Skipping / finishing the tour is what lets the walkthrough resume.
    releaseTour();
    expect(getActiveOverlayLayer()).toBe("project-walkthrough");
  });

  test("releasing every claim goes back to idle, so the install banner returns", () => {
    const releaseWalkthrough = claimOverlayLayer("project-walkthrough");
    const releaseTour = claimOverlayLayer("tour");
    releaseTour();
    releaseWalkthrough();
    expect(getActiveOverlayLayer()).toBeNull();
  });

  test("releasing twice is harmless", () => {
    const release = claimOverlayLayer("tour");
    release();
    release();
    expect(getActiveOverlayLayer()).toBeNull();
  });
});

describe("subscription — drives useSyncExternalStore", () => {
  test("subscribers are notified when the active layer changes", () => {
    const seen: (string | null)[] = [];
    const unsubscribe = subscribeOverlayLayers(() => {
      seen.push(getActiveOverlayLayer());
    });

    const releaseWalkthrough = claimOverlayLayer("project-walkthrough");
    const releaseTour = claimOverlayLayer("tour");
    releaseTour();
    releaseWalkthrough();
    unsubscribe();

    expect(seen).toEqual([
      "project-walkthrough",
      "tour",
      "project-walkthrough",
      null,
    ]);
  });

  test("a claim that does not change the winner does not notify", () => {
    // Re-render churn must not tear the store: the snapshot is only published
    // when the ACTIVE layer actually changes, or useSyncExternalStore would
    // re-render forever.
    claimOverlayLayer("tour");
    const listener = vi.fn();
    const unsubscribe = subscribeOverlayLayers(listener);
    claimOverlayLayer("project-walkthrough");
    claimOverlayLayer("tour");
    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });

  test("unsubscribed listeners stop hearing about changes", () => {
    const listener = vi.fn();
    subscribeOverlayLayers(listener)();
    claimOverlayLayer("tour");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("server snapshot", () => {
  test("nothing is ever claimed during SSR", () => {
    claimOverlayLayer("tour");
    expect(getServerOverlayLayer()).toBeNull();
  });
});
