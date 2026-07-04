"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "@/components/kit";
import { cn } from "@/lib/cn";

function fmt(totalSeconds: number): string {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Session stopwatch: live timer + start/stop + log, with host-provided today/week totals. */
export function Stopwatch({
  onLogSession,
}: {
  onLogSession: (seconds: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [log, setLog] = useState<number[]>([]);
  const startRef = useRef(0);
  const baseRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = performance.now();
    const id = setInterval(() => {
      setElapsed(baseRef.current + (performance.now() - startRef.current) / 1000);
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  function toggle() {
    if (running) {
      baseRef.current = elapsed;
      setRunning(false);
    } else {
      setRunning(true);
    }
  }

  function logSession() {
    if (elapsed < 1) return;
    const secs = Math.round(elapsed);
    setLog((l) => [secs, ...l].slice(0, 6));
    onLogSession(secs);
    setRunning(false);
    baseRef.current = 0;
    setElapsed(0);
  }

  return (
    <Panel label="SESSION" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "font-num1 text-num1 tabular-nums",
            running ? "text-green text-glow-green" : "text-cyan-lite",
          )}
        >
          {fmt(elapsed)}
        </span>
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
  );
}
