"use client";

import { useEffect, useState } from "react";

/**
 * Global Comfortable/Compact density preference (D1, DESKTOP §6/§9).
 *
 * The choice is stored in localStorage and reflected as a
 * `data-density` attribute on `<html>` so plain CSS (the
 * --density-row-h / --density-card-pad-* tokens in globals.css) can
 * key table row heights + card padding off it — one source of truth,
 * no JS branching in every consumer.
 *
 * Comfortable is the default. A tiny inline bootstrap script in the
 * root layout applies the stored value before first paint so there's
 * no comfortable→compact flash on reload.
 *
 * Mirrors the SSR-safe pattern of useNavRailCollapsed /
 * useLibraryViewMode: start at the default for server/client markup
 * parity, then hydrate from storage in an effect.
 */
export type Density = "comfortable" | "compact";

export const DENSITY_STORAGE_KEY = "mm.density";
const DEFAULT: Density = "comfortable";

export function parseStoredDensity(raw: string | null | undefined): Density {
  return raw === "compact" ? "compact" : DEFAULT;
}

/** Reflect the density onto <html data-density>. Comfortable removes
 *  the attribute entirely (the CSS defaults are Comfortable), so the
 *  DOM stays clean in the common case. */
function applyDensityAttr(density: Density): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (density === "compact") el.setAttribute("data-density", "compact");
  else el.removeAttribute("data-density");
}

function readStored(): Density {
  if (typeof window === "undefined") return DEFAULT;
  return parseStoredDensity(window.localStorage.getItem(DENSITY_STORAGE_KEY));
}

export function useDensity(): [Density, (next: Density) => void] {
  const [density, setDensity] = useState<Density>(DEFAULT);

  useEffect(() => {
    setDensity(readStored());
  }, []);

  function update(next: Density) {
    setDensity(next);
    applyDensityAttr(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
    }
  }

  return [density, update];
}

/**
 * Inline bootstrap snippet — runs before first paint (dangerouslySet
 * in the root layout <head>/early <body>) so the stored density is on
 * <html> before any styled content renders. Kept dependency-free and
 * tiny; mirrors common no-FOUC theme bootstraps. Failures are swallowed
 * (private mode / disabled storage) — the CSS default (Comfortable)
 * then applies.
 */
export const DENSITY_BOOTSTRAP_SCRIPT = `try{var d=localStorage.getItem(${JSON.stringify(
  DENSITY_STORAGE_KEY,
)});if(d==="compact"){document.documentElement.setAttribute("data-density","compact");}}catch(e){}`;
