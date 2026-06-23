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

  const promptInstall = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event can only be used once — clear it so the button disappears.
    setDeferred(null);
    return outcome;
  }, [deferred]);

  return { canInstall: deferred !== null, promptInstall };
}
