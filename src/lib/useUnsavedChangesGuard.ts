"use client";

import { useEffect } from "react";

export const UNSAVED_CHANGES_MESSAGE =
  "You have unsaved changes that will be lost. Leave this page?";

/**
 * Warn before navigating away from a page with unsaved edits. The App Router
 * has no first-class navigation-guard API, so we cover the two real exit
 * vectors while `active` is true:
 *
 *   1. Hard unload (tab close, reload, typing a new URL) — the native
 *      `beforeunload` prompt.
 *   2. In-app navigation via a Link / anchor — a capturing `click` listener
 *      that confirms before letting the click through. Programmatic
 *      `router.push` (e.g. a successful Save) is intentionally NOT intercepted
 *      here, so callers stay in control of their own post-save redirect.
 *
 * The listener is deliberately conservative: it ignores modified clicks,
 * new-tab / download / hash links, cross-origin hrefs, and same-page links.
 */
export function useUnsavedChangesGuard(
  active: boolean,
  message: string = UNSAVED_CHANGES_MESSAGE,
): void {
  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers require returnValue to be set to trigger the prompt.
      e.returnValue = "";
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      // Left-click only, no modifier (those open new tabs / windows).
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same path + query → not navigating away from this editor.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture phase so we run before Next's Link click handler.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active, message]);
}
