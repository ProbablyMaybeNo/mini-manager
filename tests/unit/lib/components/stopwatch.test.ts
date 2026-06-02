/**
 * Phase-14 spillover — Stopwatch component contract.
 *
 * Mix of source-string assertions (mount contract, button wiring, no
 * cyan, no bracketed buttons) and a couple of unit tests for the pure
 * formatHms / formatRollup helpers exported off the component.
 */
import { describe, expect, test, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

// Stopwatch imports server actions. Stub the action module so importing
// the component doesn't pull in next-auth at unit test time.
vi.mock("@/lib/actions/paintSessions", () => ({
  startSession: vi.fn(),
  pauseSession: vi.fn(),
  resumeSession: vi.fn(),
  endSession: vi.fn(),
}));

describe("Stopwatch component surface", () => {
  const src = read("src/components/focus/Stopwatch.tsx");

  test("renders all four lifecycle action handlers", () => {
    expect(src).toContain("handleStart");
    expect(src).toContain("handlePause");
    expect(src).toContain("handleResume");
    expect(src).toContain("handleStop");
  });

  test("calls the correct server action for each lifecycle event", () => {
    expect(src).toContain("startSession({ projectId })");
    expect(src).toContain("pauseSession({ sessionId })");
    expect(src).toContain("resumeSession({ sessionId, addPausedMs })");
    expect(src).toContain("endSession({ sessionId, addPausedMs })");
  });

  test("uses Button primitive — no raw <button>s", () => {
    // The component must funnel every action through the Button
    // primitive for the P13.1 solid-fill discipline.
    expect(src).not.toMatch(/<button(\s|\/>)/);
  });

  test("bans cyan from the action buttons", () => {
    // Stopwatch buttons must not use the cyan-anchored variants
    // (primary/secondary). Start = green, Pause = warning-yellow,
    // Resume = green, Stop = red.
    expect(src).not.toMatch(/variant=["']primary["']/);
    expect(src).not.toMatch(/variant=["']secondary["']/);
  });

  test("Start button is success-green; Stop is danger-red", () => {
    expect(src).toMatch(/variant="success"[^>]*>[\s\S]*?Start/);
    expect(src).toMatch(/variant="danger"[^>]*>[\s\S]*?Stop/);
  });

  test("Pause is warning-yellow, Resume returns to success-green", () => {
    expect(src).toMatch(/variant="warning"[^>]*>[\s\S]*?Pause/);
    expect(src).toMatch(/variant="success"[^>]*>[\s\S]*?Resume/);
  });

  test("ticks via setInterval + useRef for the timer handle", () => {
    expect(src).toContain("setInterval");
    expect(src).toContain("intervalRef");
  });

  test("cleans up the interval on unmount + on status change", () => {
    expect(src).toContain("clearInterval(intervalRef.current)");
  });

  test("rollup display shows today + this week side by side", () => {
    expect(src).toContain("todaySeconds");
    expect(src).toContain("weekSeconds");
  });

  test("warns when another project has an open session", () => {
    expect(src).toContain("otherProjectInProgress");
    expect(src).toContain("Another project has an open session");
  });
});

describe("Stopwatch — pure helpers", () => {
  test.each([
    [0, "00:00"],
    [59, "00:59"],
    [60, "01:00"],
    [3599, "59:59"],
    [3600, "1:00:00"],
    [3661, "1:01:01"],
  ])("formatHms(%i) → %s", async (input, expected) => {
    const { _formatHms } = await import("@/components/focus/Stopwatch");
    expect(_formatHms(input)).toBe(expected);
  });

  test.each([
    [0, "0m"],
    [59, "0m"],
    [60, "1m"],
    [3600, "1h"],
    [3660, "1h 1m"],
    [7200, "2h"],
    [7260, "2h 1m"],
  ])("formatRollup(%i) → %s", async (input, expected) => {
    const { _formatRollup } = await import("@/components/focus/Stopwatch");
    expect(_formatRollup(input)).toBe(expected);
  });
});

describe("Dashboard page — Stopwatch wiring (Phase-14 spillover)", () => {
  const src = read("src/app/projects/page.tsx");

  test("imports and mounts the Stopwatch", () => {
    expect(src).toContain('import { Stopwatch }');
    expect(src).toContain("<Stopwatch");
  });

  test("reads in-progress session + rollups in the page-level Promise.all", () => {
    expect(src).toContain("getInProgressSession(userId)");
    expect(src).toContain("getSessionRollups(userId)");
  });

  test("only mounts the Stopwatch when a focus project is set", () => {
    // The Stopwatch is rendered inside the `focusBundle ?` conditional
    // — no focus = no stopwatch (matches the FOCUS empty state).
    expect(src).toMatch(
      /focusBundle\s*\?[\s\S]{0,400}<Stopwatch/,
    );
  });
});
