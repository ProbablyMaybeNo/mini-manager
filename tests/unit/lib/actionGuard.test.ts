import { describe, expect, test, vi } from "vitest";
import { guarded, SAVE_FAILED_MESSAGE } from "@/lib/actionGuard";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * R2-9 — a rejected server action must come back as a reportable failure, not
 * as a rejection that escapes a transition into the route error boundary.
 *
 * The live bug: `await updateWishlistItem(...)` inside `startTransition`, with
 * no try/catch. Offline, the action rejects, React routes the rejection to the
 * nearest error boundary, and the whole app is replaced by the fault screen —
 * taking the collection row / recipe / typed note with it.
 */

const ok: ActionResult<{ id: string }> = { ok: true, data: { id: "p1" } };

describe("guarded — a rejection becomes a failed result, never a rejection", () => {
  test("passes a successful result straight through, untouched", async () => {
    const res = await guarded(async () => ok);
    expect(res).toBe(ok);
  });

  test("passes a HANDLED failure straight through, preserving its own error", async () => {
    const res = await guarded<{ id: string }>(async () => ({
      ok: false,
      error: "Title is required",
    }));
    expect(res).toEqual({ ok: false, error: "Title is required" });
  });

  test("preserves the extra failure fields the UI branches on", async () => {
    // `reason` (J1) and `upgradeUrl` (P10.2) drive real UI paths — the guard
    // must not flatten a handled failure into a generic one.
    const res = await guarded<{ id: string }>(async () => ({
      ok: false,
      error: "We couldn’t read that link",
      reason: "unreadable",
      upgradeUrl: "/pricing",
    }));
    expect(res).toMatchObject({
      ok: false,
      reason: "unreadable",
      upgradeUrl: "/pricing",
    });
  });

  test("a REJECTED action resolves to a failed result instead of rejecting", async () => {
    // What `fetch` does when the device is offline — the exact live cause.
    const action = vi.fn(async (): Promise<ActionResult<{ id: string }>> => {
      throw new TypeError("Failed to fetch");
    });

    const res = await guarded(action);

    expect(res.ok).toBe(false);
    expect(res).toEqual({ ok: false, error: SAVE_FAILED_MESSAGE });
  });

  test("never rejects back at the caller — the property the transition relies on", async () => {
    await expect(
      guarded(async () => {
        throw new Error("boom");
      }),
    ).resolves.toEqual({ ok: false, error: SAVE_FAILED_MESSAGE });
  });

  test("a synchronously throwing action is caught too", async () => {
    await expect(
      guarded(() => {
        throw new Error("thrown before the promise exists");
      }),
    ).resolves.toEqual({ ok: false, error: SAVE_FAILED_MESSAGE });
  });

  test("the reported message is overridable where 'save' isn't the verb", async () => {
    const res = await guarded(
      async (): Promise<ActionResult<{ slug: string }>> => {
        throw new Error("offline");
      },
      "Couldn’t create the share link — check your connection, then try again.",
    );
    expect(res).toEqual({
      ok: false,
      error: "Couldn’t create the share link — check your connection, then try again.",
    });
  });

  test("the default message names the fix, not the fault", async () => {
    // It is a transient, retryable condition; the copy has to say so rather
    // than read as "your data is gone".
    expect(SAVE_FAILED_MESSAGE).toContain("try again");
    expect(SAVE_FAILED_MESSAGE).not.toMatch(/error|failed/i);
  });

  test("calls the action exactly once", async () => {
    const action = vi.fn(async () => ok);
    await guarded(action);
    expect(action).toHaveBeenCalledTimes(1);
  });
});
