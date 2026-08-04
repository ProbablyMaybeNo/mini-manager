import { describe, expect, test } from "vitest";
import {
  EMPTY_FOCUS_SESSION,
  FOCUS_SESSION_MAX_SECONDS,
  elapsedSeconds,
  isEmptyFocusSession,
  parseFocusSession,
  pausedAt,
  serializeFocusSession,
  startedAt,
  type FocusSession,
} from "@/lib/focusSession";

/**
 * R4-7 — the arithmetic that makes a focus session restorable. The stopwatch
 * used to hold a tick count in component state, which cannot survive an
 * unmount; a session held as `{ banked, startedAt }` can, because elapsed is
 * recomputed from the wall clock wherever it is read. That recomputation, and
 * the defence against a stored record that has gone stale or bad, is what is
 * worth pinning here — the React binding is covered end to end by
 * tests/e2e/qa_focus_session.spec.ts.
 */

const T0 = 1_770_000_000_000; // an arbitrary fixed "now"

describe("elapsedSeconds", () => {
  test("a paused session is exactly what it banked, whatever the clock says", () => {
    const paused: FocusSession = { baseSeconds: 42, startedAt: null };
    expect(elapsedSeconds(paused, T0)).toBe(42);
    expect(elapsedSeconds(paused, T0 + 60_000)).toBe(42);
  });

  test("a running session keeps counting on the wall clock", () => {
    const running: FocusSession = { baseSeconds: 0, startedAt: T0 };
    expect(elapsedSeconds(running, T0)).toBe(0);
    expect(elapsedSeconds(running, T0 + 3_000)).toBe(3);
    // The whole point: time passes while the component is unmounted.
    expect(elapsedSeconds(running, T0 + 600_000)).toBe(600);
  });

  test("a resumed session adds the live run to what was banked", () => {
    const resumed: FocusSession = { baseSeconds: 90, startedAt: T0 };
    expect(elapsedSeconds(resumed, T0 + 30_000)).toBe(120);
  });

  test("a startedAt in the future contributes nothing rather than counting backwards", () => {
    // System clock changes and cross-tab skew both produce this.
    const skewed: FocusSession = { baseSeconds: 10, startedAt: T0 + 5_000 };
    expect(elapsedSeconds(skewed, T0)).toBe(10);
  });
});

describe("pausedAt / startedAt", () => {
  test("pausing banks the running time and stops the clock", () => {
    const paused = pausedAt({ baseSeconds: 5, startedAt: T0 }, T0 + 10_000);
    expect(paused).toEqual({ baseSeconds: 15, startedAt: null });
  });

  test("pausing an already-paused session changes nothing", () => {
    const session: FocusSession = { baseSeconds: 15, startedAt: null };
    expect(pausedAt(session, T0)).toBe(session);
  });

  test("starting keeps what was banked", () => {
    expect(startedAt({ baseSeconds: 15, startedAt: null }, T0)).toEqual({
      baseSeconds: 15,
      startedAt: T0,
    });
  });

  test("starting an already-running session does not restart the clock", () => {
    const running: FocusSession = { baseSeconds: 0, startedAt: T0 };
    expect(startedAt(running, T0 + 10_000)).toBe(running);
  });

  test("start → pause → start → pause accumulates rather than replacing", () => {
    let s = startedAt(EMPTY_FOCUS_SESSION, T0);
    s = pausedAt(s, T0 + 4_000);
    s = startedAt(s, T0 + 60_000);
    s = pausedAt(s, T0 + 66_000);
    expect(elapsedSeconds(s, T0 + 999_999)).toBe(10);
  });
});

describe("parseFocusSession", () => {
  test("round-trips a running session", () => {
    const session: FocusSession = { baseSeconds: 12.5, startedAt: T0 };
    expect(parseFocusSession(serializeFocusSession(session), T0 + 1_000)).toEqual(session);
  });

  test("round-trips a paused session", () => {
    const session: FocusSession = { baseSeconds: 300, startedAt: null };
    expect(parseFocusSession(serializeFocusSession(session), T0)).toEqual(session);
  });

  test("nothing stored means no session", () => {
    expect(parseFocusSession(null, T0)).toEqual(EMPTY_FOCUS_SESSION);
    expect(parseFocusSession(undefined, T0)).toEqual(EMPTY_FOCUS_SESSION);
    expect(parseFocusSession("", T0)).toEqual(EMPTY_FOCUS_SESSION);
  });

  test("garbage in storage degrades to no session, it does not throw", () => {
    expect(parseFocusSession("{not json", T0)).toEqual(EMPTY_FOCUS_SESSION);
    expect(parseFocusSession("null", T0)).toEqual(EMPTY_FOCUS_SESSION);
    expect(parseFocusSession('"a string"', T0)).toEqual(EMPTY_FOCUS_SESSION);
    expect(parseFocusSession("[1,2,3]", T0)).toEqual(EMPTY_FOCUS_SESSION);
    expect(parseFocusSession('{"baseSeconds":"lots","startedAt":"now"}', T0)).toEqual(
      EMPTY_FOCUS_SESSION,
    );
    expect(parseFocusSession('{"baseSeconds":-90,"startedAt":0}', T0)).toEqual(
      EMPTY_FOCUS_SESSION,
    );
  });

  test("a run older than the ceiling is an abandoned tab, not a session", () => {
    // Restoring it would offer a Log button over hours the painter never
    // painted — worse than losing it.
    const stale = serializeFocusSession({
      baseSeconds: 0,
      startedAt: T0 - (FOCUS_SESSION_MAX_SECONDS + 60) * 1000,
    });
    expect(parseFocusSession(stale, T0)).toEqual(EMPTY_FOCUS_SESSION);

    const justInside = serializeFocusSession({
      baseSeconds: 0,
      startedAt: T0 - (FOCUS_SESSION_MAX_SECONDS - 60) * 1000,
    });
    expect(parseFocusSession(justInside, T0).startedAt).not.toBeNull();
  });

  test("a banked-but-huge session is dropped by the same ceiling", () => {
    const stale = serializeFocusSession({
      baseSeconds: FOCUS_SESSION_MAX_SECONDS + 1,
      startedAt: null,
    });
    expect(parseFocusSession(stale, T0)).toEqual(EMPTY_FOCUS_SESSION);
  });
});

describe("isEmptyFocusSession", () => {
  test("distinguishes 'nothing to restore' from a paused session worth keeping", () => {
    expect(isEmptyFocusSession(EMPTY_FOCUS_SESSION)).toBe(true);
    expect(isEmptyFocusSession({ baseSeconds: 0, startedAt: T0 })).toBe(false);
    expect(isEmptyFocusSession({ baseSeconds: 7, startedAt: null })).toBe(false);
  });
});
