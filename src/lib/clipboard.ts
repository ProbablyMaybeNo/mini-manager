/**
 * R2-1 — clipboard writes that report what actually happened.
 *
 * `navigator.clipboard.writeText` rejects on a denied permission, an
 * insecure context, or a document that isn't focused. The call sites used to
 * `void` the promise and fire "Copied" unconditionally, so a rejection told
 * the painter their value was on the clipboard when it wasn't — worst on
 * /tools/match, where the hex appears nowhere else on screen and is simply
 * lost.
 *
 * Routing every write through here makes the success message conditional on
 * the write resolving, and forces the caller to supply a failure message —
 * which is where the value itself belongs, so it stays readable by hand.
 * `ShareLinkBar` / `ShareLinkDialog` keep their own try/catch: their value
 * sits in a persistent selectable field, so they need no message at all.
 */

/** The kit toast's tones, restated so this module stays UI-free. */
export type CopyTone = "green" | "red";

export interface CopyMessages {
  /** Fired only once the write resolves. */
  copied: string;
  /** Fired when it rejects — carry the value so it stays recoverable. */
  failed: string;
}

/**
 * Copy `text`, then `report` the outcome exactly once. Never throws and
 * never rejects, so callers can `void` the result safely. Resolves to
 * whether the value actually reached the clipboard.
 */
export async function copyText(
  text: string,
  report: (message: string, tone: CopyTone) => void,
  messages: CopyMessages,
): Promise<boolean> {
  try {
    const clipboard =
      typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!clipboard) throw new Error("Clipboard unavailable");
    await clipboard.writeText(text);
  } catch {
    report(messages.failed, "red");
    return false;
  }
  // Reported outside the try: a throwing `report` is the caller's bug, not a
  // clipboard failure, and must not also fire the failure message.
  report(messages.copied, "green");
  return true;
}
