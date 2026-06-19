"use client";

import { useEffect } from "react";

/**
 * Dev-only: applies the Theme Studio's live token overrides across the WHOLE
 * app. The studio writes the chosen --color/--font/--text values to
 * localStorage; this reads them on every page load and re-applies on cross-tab
 * `storage` events, so tweaking a slider in the studio re-skins every page in
 * real time. Rendered only in development (see RootLayout); a no-op in prod.
 */
export const THEME_OVERRIDE_KEY = "mm-theme-overrides";

export function applyThemeOverrides() {
  try {
    const raw = localStorage.getItem(THEME_OVERRIDE_KEY);
    const root = document.documentElement;
    // Clear any previously-applied overrides first so removals take effect.
    for (const name of Array.from(root.style)) {
      if (name.startsWith("--color-") || name.startsWith("--font-") || name.startsWith("--text-")) {
        root.style.removeProperty(name);
      }
    }
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(obj)) {
      if (v) root.style.setProperty(k, v);
    }
  } catch {
    /* ignore malformed storage */
  }
}

export function ThemeOverrides() {
  useEffect(() => {
    applyThemeOverrides();
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_OVERRIDE_KEY) applyThemeOverrides();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
