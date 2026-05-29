/**
 * Web Share API helper. Wraps `navigator.share` with a feature-detect
 * and consistent error handling so the UI doesn't have to.
 *
 * Per the spec, a cancelled share dialog and a successful share are
 * indistinguishable from the caller's side — both resolve. We return
 * `true` for "the dialog completed" and `false` for "the API isn't
 * available" (so the caller can fall back). Genuine errors (permission
 * denied, abort) re-resolve as `true` because the painter saw the
 * sheet and chose to dismiss; the URL / QR / Markdown / JSON fallbacks
 * remain available right below the share button if they cancel.
 */

export interface NativeSharePayload {
  title?: string;
  text?: string;
  url?: string;
}

/**
 * Feature-detected at module evaluation so the caller can hide the
 * button instead of hiding only on the click failing. Safe in SSR
 * because `typeof navigator` is `undefined` on the server.
 */
export const isNativeShareSupported: boolean =
  typeof navigator !== "undefined" &&
  typeof (navigator as Navigator & { share?: unknown }).share === "function";

export async function nativeShare(
  payload: NativeSharePayload,
): Promise<boolean> {
  if (!isNativeShareSupported) return false;

  try {
    // navigator.share is typed in lib.dom.d.ts as accepting ShareData
    // with all fields optional.
    await navigator.share(payload);
    return true;
  } catch (err) {
    // AbortError: the painter cancelled — still treat the affordance
    // as having fired. Other errors (NotAllowedError, TypeError on
    // empty payload) — fall back so the four-section modal is the
    // primary path.
    if (err instanceof Error && err.name === "AbortError") {
      return true;
    }
    return false;
  }
}
