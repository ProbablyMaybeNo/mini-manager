"use client";

import { useEffect, useState } from "react";
import { CloseButton } from "@/components/kit";
import { useInstallPrompt } from "./useInstallPrompt";

/** localStorage flag so a dismissed banner stays dismissed across sessions. */
const DISMISSED_KEY = "mm-install-dismissed";

function wasDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * A small, dismissible "Install app" banner pinned to the bottom-right of the
 * signed-in surface. It only ever appears when the browser has fired
 * `beforeinstallprompt` (so it's genuinely installable), the user hasn't
 * dismissed it before, and the app isn't already installed. It never
 * auto-opens anything — it's a passive prompt the user can act on or close.
 *
 * Dismissing remembers the choice; installing (or declining the native
 * prompt) removes it for the session.
 */
export function InstallBanner() {
  const { canInstall, promptInstall } = useInstallPrompt();
  // Start hidden and only reveal after reading localStorage on the client, so
  // SSR and the first client render agree (no hydration mismatch).
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(wasDismissed());
  }, []);

  if (dismissed || !canInstall) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private mode / blocked storage — just hide it for this session.
    }
    setDismissed(true);
  }

  return (
    <div
      role="dialog"
      aria-label="Install The Mini Mainframe"
      className="fixed bottom-4 right-4 z-50 flex max-w-[min(20rem,calc(100vw-2rem))] items-start gap-3 border border-cyan/60 bg-bg px-4 py-3 panel-depth"
    >
      <div className="flex flex-col gap-2">
        <p className="label-osd tracking-[0.18em] text-cyan-lite">Install app</p>
        <p className="font-body text-body text-fg">
          Add The Mini Mainframe to your device for a full-screen, app-like
          bench.
        </p>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={async () => {
              const outcome = await promptInstall();
              // Whatever the user chose, don't show this banner again.
              if (outcome !== "unavailable") dismiss();
            }}
            className="border border-cyan bg-cyan/15 px-3 py-1 font-button text-button uppercase tracking-[0.15em] text-cyan-lite glow-cyan transition-colors hover:bg-cyan/25"
          >
            ⬇ Install
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="border-0 bg-transparent px-2 py-1 font-button text-button uppercase tracking-[0.15em] text-fg-dim underline-offset-4 transition-colors hover:text-cyan-lite hover:underline"
          >
            Not now
          </button>
        </div>
      </div>
      <CloseButton aria-label="Dismiss install prompt" onClick={dismiss} />
    </div>
  );
}
