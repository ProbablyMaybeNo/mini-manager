/**
 * The running focus session, as a value (R4-7).
 *
 * `/focus` is "your painting bench — recipe, progress, time … in one place",
 * and the stopwatch lived entirely in component state. Navigating to LIBRARY
 * to look a paint up — the single most likely thing a painter does mid-session
 * — unmounted it and the elapsed time was dropped, not banked: back on the
 * bench the clock read 00:00:00 and TIME/TODAY/WEEK were unchanged. A reload
 * did the same, and nothing in storage could restore it.
 *
 * The session is now a record rather than a tick count, which is what makes it
 * restorable: `startedAt` is epoch ms (NOT `performance.now()`, which is
 * relative to the document and dies with it), so elapsed is recomputed from
 * the wall clock wherever and whenever it is read. A session that was running
 * when the painter left is still running when they come back, by the same
 * arithmetic — that is the point.
 *
 * This module is pure: no storage, no React. The store that persists it lives
 * in `src/hooks/useFocusSession.ts`, the way `overlayLayers` /
 * `useOverlayLayer` are split.
 */

/** localStorage key. `mm.<area>.<thing>`, matching the kit's other keys. */
export const FOCUS_SESSION_STORAGE_KEY = "mm.focus.session";

/**
 * Past this, a stored run is an abandoned tab rather than a session, and
 * restoring it would offer the painter a Log button over a number they never
 * painted. A long bench session is four or five hours; twelve is generous and
 * unambiguous.
 */
export const FOCUS_SESSION_MAX_SECONDS = 12 * 60 * 60;

export interface FocusSession {
  /** Seconds already banked by previous start/stop cycles in this session. */
  baseSeconds: number;
  /** Epoch ms the current run started, or null while the timer is paused. */
  startedAt: number | null;
}

export const EMPTY_FOCUS_SESSION: FocusSession = { baseSeconds: 0, startedAt: null };

/** Whether anything is worth restoring — used to skip writing a blank record. */
export function isEmptyFocusSession(session: FocusSession): boolean {
  return session.baseSeconds === 0 && session.startedAt === null;
}

/** Elapsed seconds at `now`. A paused session ignores `now` entirely. */
export function elapsedSeconds(session: FocusSession, now: number): number {
  const live =
    session.startedAt === null ? 0 : Math.max(0, (now - session.startedAt) / 1000);
  return Math.max(0, session.baseSeconds + live);
}

/** Bank the running time and stop the clock. */
export function pausedAt(session: FocusSession, now: number): FocusSession {
  if (session.startedAt === null) return session;
  return { baseSeconds: elapsedSeconds(session, now), startedAt: null };
}

/** Start (or resume) the clock, keeping whatever was already banked. */
export function startedAt(session: FocusSession, now: number): FocusSession {
  if (session.startedAt !== null) return session;
  return { baseSeconds: session.baseSeconds, startedAt: now };
}

export function serializeFocusSession(session: FocusSession): string {
  return JSON.stringify({
    baseSeconds: session.baseSeconds,
    startedAt: session.startedAt,
  });
}

/**
 * Read a stored record back, defensively — this is untrusted input from a
 * previous version of the app, another tab, or a hand-edited localStorage.
 * Anything unparseable, negative, non-finite or older than
 * {@link FOCUS_SESSION_MAX_SECONDS} degrades to "no session".
 */
export function parseFocusSession(
  raw: string | null | undefined,
  now: number,
): FocusSession {
  if (!raw) return EMPTY_FOCUS_SESSION;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_FOCUS_SESSION;
  }
  if (typeof data !== "object" || data === null) return EMPTY_FOCUS_SESSION;

  const record = data as Record<string, unknown>;
  const base = record.baseSeconds;
  const start = record.startedAt;

  const session: FocusSession = {
    baseSeconds:
      typeof base === "number" && Number.isFinite(base) && base >= 0 ? base : 0,
    // A `startedAt` in the future (clock skew, a tab that outlived a system
    // time change) is kept: `elapsedSeconds` floors its contribution at zero,
    // so the timer resumes from what was banked rather than counting backwards.
    startedAt:
      typeof start === "number" && Number.isFinite(start) && start > 0 ? start : null,
  };

  if (elapsedSeconds(session, now) > FOCUS_SESSION_MAX_SECONDS) {
    return EMPTY_FOCUS_SESSION;
  }
  return isEmptyFocusSession(session) ? EMPTY_FOCUS_SESSION : session;
}
