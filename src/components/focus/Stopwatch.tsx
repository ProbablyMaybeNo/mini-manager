"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import {
  startSession,
  pauseSession,
  resumeSession,
  endSession,
} from "@/lib/actions/paintSessions";

/**
 * Phase-14 spillover — FOCUS panel stopwatch.
 *
 * States:
 *   - idle    → no open session. "Start" button.
 *   - running → session in flight. "Pause" + "Stop".
 *   - paused  → session in flight but tick suspended. "Resume" + "Stop".
 *
 * Live counter uses setInterval on a 1s tick + useRef for the timer
 * handle (so the interval can be cleaned up across re-renders without
 * triggering effects). Pause stops the tick, records the moment, and
 * accumulates the elapsed pause time when the user clicks Resume.
 *
 * On reload mid-session the server reads the in-progress row and
 * resumes the counter from `startedAt` minus `pausedMs`. If the user
 * closed the tab while paused, the resume path will still tick from
 * the resume click — paused time accumulates correctly.
 *
 * Rollups ("Today: 1h 47m", "This week: 8h 12m") are server-rendered
 * once per page load — the stopwatch does not refetch them; they
 * update naturally on the next dashboard render (Stop → revalidate →
 * Server Component re-runs → fresh rollup).
 */

interface Props {
  projectId: string;
  /** Existing open session for this user, if any. When present the
   *  stopwatch boots into running state and ticks from `startedAt`. */
  inProgressSession: {
    id: string;
    projectId: string;
    startedAt: number;
    pausedMs: number;
  } | null;
  /** Today's completed-session seconds (excludes the in-progress row). */
  todaySeconds: number;
  /** This week's completed-session seconds. */
  weekSeconds: number;
}

type Status = "idle" | "running" | "paused";

function formatHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatRollup(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s === 0) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function Stopwatch({
  projectId,
  inProgressSession,
  todaySeconds,
  weekSeconds,
}: Props) {
  // If a session is already in-progress AND it's for THIS project,
  // boot into running state. If it's for a different project, surface
  // a "resume previous session?" affordance so the painter can stop or
  // adopt the existing one before starting fresh.
  const otherProjectInProgress =
    inProgressSession != null && inProgressSession.projectId !== projectId;
  const sameProjectInProgress =
    inProgressSession != null && inProgressSession.projectId === projectId;

  const [status, setStatus] = useState<Status>(
    sameProjectInProgress ? "running" : "idle",
  );
  const [sessionId, setSessionId] = useState<string | null>(
    sameProjectInProgress ? inProgressSession.id : null,
  );
  const [startedAtMs, setStartedAtMs] = useState<number | null>(
    sameProjectInProgress ? inProgressSession.startedAt : null,
  );
  /** Cumulative pause time persisted server-side (committed on resume). */
  const [serverPausedMs, setServerPausedMs] = useState<number>(
    sameProjectInProgress ? inProgressSession.pausedMs : 0,
  );
  /** Pause-window start time. Null when running. */
  const [pauseStartMs, setPauseStartMs] = useState<number | null>(null);
  const [tick, setTick] = useState<number>(Date.now());
  const intervalRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 1Hz live tick when running. Cleared on pause/stop/unmount.
  useEffect(() => {
    if (status !== "running") {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setTick(Date.now());
    }, 1_000);
    return () => {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status]);

  const liveSeconds =
    status === "idle" || startedAtMs == null
      ? 0
      : Math.max(
          0,
          Math.floor(
            (tick - startedAtMs - serverPausedMs) / 1000,
          ),
        );

  const handleStart = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await startSession({ projectId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSessionId(result.data.sessionId);
      setStartedAtMs(result.data.startedAt);
      setServerPausedMs(0);
      setPauseStartMs(null);
      setStatus("running");
      setTick(Date.now());
    });
  }, [projectId]);

  const handlePause = useCallback(() => {
    if (!sessionId) return;
    setError(null);
    setPauseStartMs(Date.now());
    setStatus("paused");
    // Fire-and-forget — the server-side pause is best-effort; the
    // accumulated pause ms is committed on resume / stop.
    startTransition(async () => {
      const result = await pauseSession({ sessionId });
      if (!result.ok) setError(result.error);
    });
  }, [sessionId]);

  const handleResume = useCallback(() => {
    if (!sessionId || pauseStartMs == null) return;
    setError(null);
    const addPausedMs = Date.now() - pauseStartMs;
    startTransition(async () => {
      const result = await resumeSession({ sessionId, addPausedMs });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setServerPausedMs((prev) => prev + addPausedMs);
      setPauseStartMs(null);
      setStatus("running");
      setTick(Date.now());
    });
  }, [sessionId, pauseStartMs]);

  const handleStop = useCallback(() => {
    if (!sessionId) return;
    setError(null);
    const addPausedMs =
      pauseStartMs != null ? Date.now() - pauseStartMs : 0;
    startTransition(async () => {
      const result = await endSession({ sessionId, addPausedMs });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus("idle");
      setSessionId(null);
      setStartedAtMs(null);
      setServerPausedMs(0);
      setPauseStartMs(null);
    });
  }, [sessionId, pauseStartMs]);

  return (
    <div
      className={clsx(
        "panel panel-ticks relative",
        "flex flex-wrap items-center gap-3",
        "px-3 pt-4 pb-3",
      )}
      data-stopwatch-project-id={projectId}
      data-stopwatch-status={status}
    >
      <span className="panel-label" aria-hidden>
        SYS ▸ TIMER
      </span>
      <div className="flex flex-col">
        <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
          Stopwatch
        </span>
        {/* Terminal readout — tabular-nums so the digits don't jitter on
            each tick; cyan while live (the active phosphor state), yellow
            while paused, dim when idle. Glow promoted while running. */}
        <span
          className={clsx(
            "font-mono text-2xl tabular-nums tracking-wider",
            status === "running"
              ? "text-[var(--color-cyan)] glow-text-strong"
              : status === "paused"
                ? "text-[var(--color-yellow)]"
                : "text-[var(--color-fg-subtle)]",
          )}
          aria-live="off"
          aria-label={`Session timer ${formatHms(liveSeconds)}`}
        >
          {formatHms(liveSeconds)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {status === "idle" ? (
          <Button
            type="button"
            variant="success"
            size="sm"
            onClick={handleStart}
            disabled={pending || otherProjectInProgress}
          >
            Start
          </Button>
        ) : null}
        {status === "running" ? (
          <>
            <Button
              type="button"
              variant="warning"
              size="sm"
              onClick={handlePause}
              disabled={pending}
            >
              Pause
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleStop}
              disabled={pending}
            >
              Stop
            </Button>
          </>
        ) : null}
        {status === "paused" ? (
          <>
            <Button
              type="button"
              variant="success"
              size="sm"
              onClick={handleResume}
              disabled={pending}
            >
              Resume
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleStop}
              disabled={pending}
            >
              Stop
            </Button>
          </>
        ) : null}
      </div>

      <div className="flex flex-col ml-auto text-right">
        <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
          Today · This week
        </span>
        <span className="font-mono text-xs text-[var(--color-fg)]">
          {formatRollup(todaySeconds)}{" "}
          <span className="text-[var(--color-fg-subtle)]">·</span>{" "}
          {formatRollup(weekSeconds)}
        </span>
      </div>

      {otherProjectInProgress ? (
        <p
          role="status"
          className="basis-full text-2xs font-mono text-[var(--color-yellow)]"
        >
          Another project has an open session — stop it before starting one here.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="basis-full text-2xs font-mono text-[var(--color-red)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Re-exported so tests can sanity-check formatting without ripping the
// component apart.
export { formatHms as _formatHms, formatRollup as _formatRollup };
