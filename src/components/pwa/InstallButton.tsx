"use client";

import { Button, Panel } from "@/components/kit";
import { useInstallPrompt } from "./useInstallPrompt";

/**
 * Unobtrusive "Install app" affordance for the account page. Renders nothing
 * unless the browser has actually offered an install (`beforeinstallprompt`)
 * AND the app isn't already installed — so it never nags, never shows on
 * unsupported browsers, and never appears to an automated browser. Just a
 * bare button (use inside an existing Panel).
 */
export function InstallButton() {
  const { canInstall, promptInstall } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <Button variant="secondary" onClick={() => void promptInstall()}>
      ⬇ Install app
    </Button>
  );
}

/**
 * Account-page "INSTALL" panel. Self-hiding: the whole Panel only mounts when
 * the app is genuinely installable, so the account grid never carries a dead
 * empty card on browsers that don't support install or where it's already
 * installed.
 */
export function InstallPanel() {
  const { canInstall, promptInstall } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <Panel label="INSTALL" className="flex flex-col gap-4 p-5">
      <p className="font-body text-body text-fg">
        Install The Mini Mainframe as an app for a full-screen, app-like bench
        — it runs from your home screen and works offline for reads.
      </p>
      <div>
        <Button variant="secondary" onClick={() => void promptInstall()}>
          ⬇ Install app
        </Button>
      </div>
    </Panel>
  );
}
