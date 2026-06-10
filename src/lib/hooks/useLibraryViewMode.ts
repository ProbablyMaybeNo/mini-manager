"use client";

import { useEffect, useState } from "react";

export type LibraryViewMode = "list" | "grid";

export const LIBRARY_VIEW_STORAGE_KEY = "mm.library.viewMode";
// FIGMA-REBUILD — the Library frame leads with the swatch-wall grid, so a
// first-time visitor opens on GRID. The choice still persists to
// localStorage, so anyone who flips to LIST stays there.
const DEFAULT: LibraryViewMode = "grid";

export function parseStoredViewMode(raw: string | null | undefined): LibraryViewMode {
  return raw === "grid" || raw === "list" ? raw : DEFAULT;
}

function readStored(): LibraryViewMode {
  if (typeof window === "undefined") return DEFAULT;
  return parseStoredViewMode(window.localStorage.getItem(LIBRARY_VIEW_STORAGE_KEY));
}

export function useLibraryViewMode(): [LibraryViewMode, (next: LibraryViewMode) => void] {
  // SSR-safe: always start with DEFAULT, hydrate from localStorage in effect.
  // Avoids hydration mismatch on first render.
  const [mode, setMode] = useState<LibraryViewMode>(DEFAULT);

  useEffect(() => {
    setMode(readStored());
  }, []);

  function update(next: LibraryViewMode) {
    setMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LIBRARY_VIEW_STORAGE_KEY, next);
    }
  }

  return [mode, update];
}
