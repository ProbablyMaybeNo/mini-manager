"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "mm.navRail.collapsed";

export function parseStoredCollapsed(raw: string | null | undefined): boolean {
  return raw === "1";
}

export function useNavRailCollapsed(): [boolean, (next: boolean) => void] {
  // SSR-safe: start expanded, hydrate from storage in effect to avoid
  // a hydration mismatch on first paint.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(parseStoredCollapsed(window.localStorage.getItem(STORAGE_KEY)));
  }, []);

  function update(next: boolean) {
    setCollapsed(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    }
  }

  return [collapsed, update];
}
