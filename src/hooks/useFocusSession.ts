"use client";

import { useSyncExternalStore } from "react";
import {
  EMPTY_FOCUS_SESSION,
  FOCUS_SESSION_STORAGE_KEY,
  isEmptyFocusSession,
  parseFocusSession,
  pausedAt,
  serializeFocusSession,
  startedAt,
  type FocusSession,
} from "@/lib/focusSession";

/**
 * The store behind the focus bench's stopwatch (R4-7) — module-level, the way
 * `overlayLayers` is, and for the same reason: what it holds has to outlive
 * the component that shows it.
 *
 * TWO LAYERS OF SURVIVAL, and they matter for different journeys.
 *   - The module snapshot survives an in-app navigation. LIBRARY and back
 *     unmounts `Stopwatch`, and the session is simply still here.
 *   - localStorage survives a reload, a crash, and a closed tab.
 * Elapsed is never stored: it is recomputed from `startedAt` on the wall
 * clock, so "still running" is true in the ordinary sense rather than a
 * number that was frozen when the component died.
 *
 * `useSyncExternalStore` with a `getServerSnapshot` of "no session" is what
 * keeps this hydration-safe — the server and the hydrating client both render
 * 00:00:00, and the restored session lands on the render straight after,
 * with no mismatch and no read of `window` during render.
 */

const listeners = new Set<() => void>();

/** Cached so `getSnapshot` is referentially stable — a snapshot that rebuilt
 *  its object every call would loop `useSyncExternalStore` forever. */
let snapshot: FocusSession = EMPTY_FOCUS_SESSION;
/** localStorage is read once per page load; after that this store is the
 *  source of truth and writes keep the two in step. */
let loaded = false;

function readStored(): FocusSession {
  if (typeof window === "undefined") return EMPTY_FOCUS_SESSION;
  try {
    return parseFocusSession(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY),
      Date.now(),
    );
  } catch {
    // Private-mode Safari and friends throw on access, not just on write.
    return EMPTY_FOCUS_SESSION;
  }
}

function publish(next: FocusSession): void {
  if (
    next.baseSeconds === snapshot.baseSeconds &&
    next.startedAt === snapshot.startedAt
  ) {
    return;
  }
  snapshot = next;
  for (const listener of listeners) listener();
}

function persist(next: FocusSession): void {
  if (typeof window === "undefined") return;
  try {
    if (isEmptyFocusSession(next)) {
      window.localStorage.removeItem(FOCUS_SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        FOCUS_SESSION_STORAGE_KEY,
        serializeFocusSession(next),
      );
    }
  } catch {
    // A session that can't be persisted still runs for this page load.
  }
}

function write(next: FocusSession): void {
  loaded = true;
  persist(next);
  publish(next);
}

function getSnapshot(): FocusSession {
  if (!loaded) {
    loaded = true;
    snapshot = readStored();
  }
  return snapshot;
}

function getServerSnapshot(): FocusSession {
  return EMPTY_FOCUS_SESSION;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab's start/stop/log is this tab's too — the session is the
  // painter's, not the document's.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== FOCUS_SESSION_STORAGE_KEY) return;
    loaded = true;
    publish(readStored());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The live session record. Re-renders on start / pause / log, and on ticks
 *  from another tab. */
export function useFocusSession(): FocusSession {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Start or resume the clock, keeping whatever is already banked. */
export function startFocusSession(now: number = Date.now()): void {
  write(startedAt(getSnapshot(), now));
}

/** Stop the clock and bank the running time. */
export function pauseFocusSession(now: number = Date.now()): void {
  write(pausedAt(getSnapshot(), now));
}

/** Session over — the elapsed time has been logged to the project. */
export function clearFocusSession(): void {
  write(EMPTY_FOCUS_SESSION);
}
