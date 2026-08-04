"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/kit";
import { cn } from "@/lib/cn";
import { elapsedSeconds } from "@/lib/focusSession";
import {
  clearFocusSession,
  pauseFocusSession,
  startFocusSession,
  useFocusSession,
} from "@/hooks/useFocusSession";

function fmt(totalSeconds: number): string {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Session stopwatch: live timer + start/stop + log.
 *
 * Renders TWO layouts off one piece of state (Ross, 2026-07-27): a slim bar for
 * phones — which FocusView pins sticky to the top of the page so a painter can
 * stop and start without scrolling mid-brushstroke — and the original labelled
 * panel from `md` up. Both markups mount, so the timer keeps running across a
 * viewport change; only one is ever visible.
 *
 * R4-7 — the session itself is NOT component state. It lives in
 * `useFocusSession`, so leaving the bench (to look a paint up in the Library,
 * say) no longer throws the elapsed time away. This component owns only the
 * repaint: `now` ticks while the clock runs, and elapsed is derived from the
 * session's `startedAt` against it.
 */
export function Stopwatch({
  onLogSession,
  /** Optional trailing readout for the phone bar (e.g. this project's lifetime
   *  total), shown small next to the live session clock. */
  totalLabel,
}: {
  onLogSession: (seconds: number) => void;
  totalLabel?: string;
}) {
  const session = useFocusSession();
  const running = session.startedAt !== null;
  // Only read while `running` — a paused session ignores it — so the lazy
  // initializer cannot desync SSR from hydration: on the hydrating render the
  // store still reports "no session" and both sides print 00:00:00.
  const [now, setNow] = useState(() => Date.now());
  const [log, setLog] = useState<number[]>([]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const elapsed = elapsedSeconds(session, now);

  function toggle() {
    if (running) {
      pauseFocusSession();
    } else {
      // Re-seed the tick clock so the first quarter-second after a resume
      // isn't drawn against a `now` from before the pause.
      setNow(Date.now());
      startFocusSession();
    }
  }

  function logSession() {
    const at = Date.now();
    const secs = Math.round(elapsedSeconds(session, at));
    if (secs < 1) return;
    setLog((l) => [secs, ...l].slice(0, 6));
    onLogSession(secs);
    clearFocusSession();
  }

  const clock = (
    <span
      className={cn(
        "font-num1 tabular-nums",
        running ? "text-green text-glow-green" : "text-cyan-lite",
      )}
    >
      {fmt(elapsed)}
    </span>
  );

  return (
    <>
      {/* ── Phone bar ─────────────────────────────────────────────────── */}
      {/* Wraps below 375px (MUX3-001). The bar didn't reflow — LOG's box stayed
          pinned at right=363 at every width, so it sat off-screen on any phone
          narrower than ~363px (3px clipped at 360, a mainstream Android width;
          43px at 320). The overflow lived inside the page shell, so there was no
          document scrollbar and nothing indicated a primary control was there. */}
      <div className="flex flex-wrap items-center gap-2 border border-cyan/40 bg-bg px-2.5 py-1.5 min-[375px]:flex-nowrap md:hidden">
        <span className="text-[22px] leading-none">{clock}</span>
        {totalLabel && (
          <span className="label-osd shrink-0 text-fg-muted">{totalLabel}</span>
        )}
        {/* START is the bench's primary action and was one of its smallest
            controls at 69×32 (MUX-005). It now takes the row's spare width at a
            44px height, with LOG demoted to a fixed-width secondary beside it. */}
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "ml-auto h-11 min-w-[96px] flex-1 border font-button text-button uppercase tracking-[0.12em]",
            running
              ? "border-red bg-red/10 text-red hover:bg-red/20"
              : "border-green bg-green/10 text-green hover:bg-green/20",
          )}
        >
          {running ? "Stop" : "Start"}
        </button>
        <button
          type="button"
          onClick={logSession}
          disabled={elapsed < 1}
          className="h-11 w-16 shrink-0 border border-cyan/60 font-button text-button uppercase tracking-[0.12em] text-cyan-lite transition-opacity hover:bg-cyan/10 disabled:opacity-30"
        >
          Log
        </button>
      </div>

      {/* ── Desktop panel ─────────────────────────────────────────────── */}
      <Panel label="SESSION" className="hidden flex-col gap-3 p-4 md:flex">
        <div className="flex items-center justify-between">
          <span className="text-num1">{clock}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggle}
              className={cn(
                "border px-3 py-1.5 font-button text-button uppercase tracking-[0.15em]",
                running
                  ? "border-red text-red hover:bg-red/10"
                  : "border-green text-green hover:bg-green/10",
              )}
            >
              {running ? "Stop" : "Start"}
            </button>
            <button
              type="button"
              onClick={logSession}
              className="border border-cyan/60 px-3 py-1.5 font-button text-button uppercase tracking-[0.15em] text-cyan-lite hover:bg-cyan/10"
            >
              Log
            </button>
          </div>
        </div>

        {log.length > 0 && (
          <ul className="flex flex-col gap-0.5 border-t border-cyan/20 pt-2 font-body text-body text-fg">
            {log.map((secs, i) => (
              <li key={i}>▸ logged {fmt(secs)}</li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
