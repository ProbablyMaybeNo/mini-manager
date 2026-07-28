"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query. SSR-safe: the server snapshot is always
 * `false`, matching the `md`-and-up split the inspector uses (DOP-002). Because
 * the inspector starts closed there is no visible flash on hydration — the
 * desktop two-pane / mobile sheet only mounts after the first client render,
 * by which point the real match value is in play. `useSyncExternalStore`
 * guarantees no hydration mismatch warning.
 */
export function useMediaQuery(query: string): boolean {
  function subscribe(onChange: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }
  function getSnapshot(): boolean {
    return typeof window !== "undefined" && window.matchMedia(query).matches;
  }
  function getServerSnapshot(): boolean {
    return false;
  }
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The app-wide desktop split: `md` (768px), consistent with SidebarRail /
 *  AppShell. `true` at ≥768px. */
export function useIsDesktop(): boolean {
  // Height-aware, matching the `desk:`/`roomy:` CSS variants. A width-only test
  // is true for every phone held in landscape, which is how the desktop
  // master-detail inspector ended up rendering in a ~390px-tall window.
  return useMediaQuery("(min-width: 768px) and (min-height: 500px)");
}
