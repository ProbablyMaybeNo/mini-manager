import type { ActionResult } from "@/lib/actions/projects";

/**
 * R2-9 — a server action that REJECTS must not take the whole app with it.
 *
 * Every mutation in this app is a server action returning `ActionResult`: a
 * handled failure comes back as `{ ok: false, error }`. A *transport* failure
 * — offline, dropped connection, a 5xx from the action endpoint — does not.
 * It rejects. And a rejection inside `startTransition` propagates to the route
 * error boundary, which replaces the entire tree with the "SOMETHING BROKE"
 * fault screen and unmounts the component holding whatever the painter had
 * typed. R2-2 fixed one panel by hand; the same shape survived in four more
 * clients (22 awaits), including `/collection`.
 *
 * A failed fetch is not an unrecoverable render fault. Routing the call
 * through here converts the rejection into the SAME `{ ok: false, error }` the
 * caller already knows how to report, so each call site keeps its existing
 * error surface (toast / inline field error) and its existing narrowing — and
 * the app stays mounted with the user's input intact. Retrying is then just
 * pressing the control again.
 */

/** The default report for a rejected save. Phrased as a transient, retryable
 *  condition, because that is what it almost always is. */
export const SAVE_FAILED_MESSAGE =
  "Couldn’t save — check your connection, then try again.";

/**
 * Await `action`, converting a rejection into a failed `ActionResult`. Never
 * throws and never rejects, so it is safe inside a transition.
 *
 * The return type is the action's own `ActionResult<T>`, so `res.ok` narrows
 * at the call site exactly as it did before.
 *
 * @param message What to report when the call rejects. Override where "save"
 *   isn't the verb (publishing a share link, deleting, scanning a photo).
 */
export async function guarded<T>(
  action: () => Promise<ActionResult<T>>,
  message: string = SAVE_FAILED_MESSAGE,
): Promise<ActionResult<T>> {
  try {
    return await action();
  } catch {
    return { ok: false, error: message };
  }
}

/** A result from the auth flows, which predate `ActionResult` and report their
 *  failure under `message` rather than `error`. */
export type MessageResult = { ok: true } | { ok: false; message: string };

/**
 * `guarded()` for actions that report failure as `message` instead of `error`
 * — `requestPasswordReset` / `applyPasswordReset`.
 *
 * Same contract: awaits `action`, converts a rejection into that action's own
 * failure shape, never throws and never rejects. Kept separate from `guarded`
 * rather than widened into it, because widening the return type would erase
 * the extra failure fields (`reason`, `upgradeUrl`) that `ActionResult` callers
 * branch on.
 *
 * `R` flows through unchanged on the non-rejecting paths, so a caller reading
 * a richer success payload keeps it.
 */
export async function guardedMessage<R extends MessageResult>(
  action: () => Promise<R>,
  message: string = SAVE_FAILED_MESSAGE,
): Promise<R | { ok: false; message: string }> {
  try {
    return await action();
  } catch {
    return { ok: false, message };
  }
}
