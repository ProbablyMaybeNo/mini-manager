"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The non-standard event Chromium fires when the app meets the installability
 * criteria. We stash it so we can call `prompt()` later, on a user gesture,
 * rather than letting the browser show its own mini-infobar.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Already running as an installed PWA (standalone display mode)? */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    // iOS Safari exposes this non-standard flag on `navigator`.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export interface InstallPromptState {
  /** True only when a real, dismissable install opportunity is available. */
  canInstall: boolean;
  /** Fire the native install prompt. No-op if nothing is stashed. Resolves to
   *  the user's choice so callers can react (e.g. hide the button). */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

/**
 * Captures `beforeinstallprompt` and exposes a gesture-driven `promptInstall`.
 *
 * Deliberately conservative — `canInstall` is false (so any UI hides itself)
 * when: the API is unsupported, the app is already installed, the app is
 * driven by an automated browser (`navigator.webdriver`), or no install event
 * has fired yet. Nothing here auto-shows; the caller renders a button the user
 * chooses to click.
 */
export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    // Never offer install to an automated browser (Playwright/E2E) or once the
    // app is already installed.
    if (typeof navigator !== "undefined" && navigator.webdriver) return;
    if (isStandalone()) return;

    const onBeforeInstall = (e: Event) => {
      // Keep the browser's own mini-infobar from showing; we drive it instead.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /**
   * R3-4 — the fifth of R2-15's unguarded awaits, and the only one wrapping a
   * browser API rather than a server action, which is why it needed a product
   * call rather than a mechanical `try`.
   *
   * The call: on a failed or rejected prompt, HIDE the control. `prompt()` and
   * `userChoice` reject for reasons the painter cannot act on — the event was
   * already spent (it is single-use), the call lost its user-gesture context,
   * the browser withdrew the offer, or the app is in fact already installed.
   * An "install failed" message would be a dead end for something they did not
   * ask to fail, so we retire the affordance instead of explaining it. If the
   * app really is still installable, Chromium fires `beforeinstallprompt`
   * again on the next visit and the button comes back on its own — the failure
   * is hidden for this session, not remembered.
   *
   * Rejection is reported as "unavailable", which callers already handle:
   * InstallBanner treats it as "don't write the permanent dismissal flag", so
   * a transient failure never costs the painter a future prompt.
   *
   * The `finally` is the actual defect fix. `deferred` doubles as the in-flight
   * flag (`canInstall` reads it), and it was only cleared on the success line —
   * so a rejection left it set, and the button stayed on screen wired to a
   * spent event, dead until reload.
   */
  const promptInstall = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      return outcome;
    } catch {
      return "unavailable" as const;
    } finally {
      // The event can only be used once — spent or rejected, it is no longer
      // usable, so clear it either way and let the button disappear.
      setDeferred(null);
    }
  }, [deferred]);

  return { canInstall: deferred !== null, promptInstall };
}
