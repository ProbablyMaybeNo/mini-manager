"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

/* ============================================================
   StatusBar — phosphor terminal chrome bar.

   Pinned to the viewport top on desktop (hidden on mobile where
   MobileHeader already shows the online dot). Four segments:
     SYS: OK / ERR        — always green on a working browser
     NET: ON / LAG / OFF  — navigator.onLine + periodic ping
     SAVED: idle or n s ago (stub — no unsaved state yet, always idle)
     TIME: HH:MM:SS live clock

   Each segment is a StatusPill-style token span, coloured via
   semantic status tokens. All text mono all-caps to match the
   Terminal_UI CRT aesthetic.
   ============================================================ */

type NetStatus = "ON" | "LAG" | "OFF";

/** Ping interval in ms. Keep it low-cost — just HEAD the origin. */
const PING_INTERVAL = 15_000;

/**
 * Deterministic first-render values. Server and client MUST agree on the
 * very first render or React throws a hydration mismatch. Real connectivity
 * and the live clock are only knowable on the client, so we render these
 * stable placeholders during SSR + hydration, then correct in `useEffect`
 * after mount.
 *
 * (Modern Node exposes a global `navigator` whose `onLine` is `undefined`,
 * so a naive `typeof navigator !== "undefined"` guard is NOT SSR-safe.)
 */
export const SSR_NET_STATUS: NetStatus = "ON";
export const CLOCK_PLACEHOLDER = "--:--:--";

function useNetStatus(): NetStatus {
  const [status, setStatus] = useState<NetStatus>(SSR_NET_STATUS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function handleOnline() {
      setStatus("ON");
    }
    function handleOffline() {
      setStatus("OFF");
    }

    // Correct the optimistic SSR default to the real client value on mount.
    setStatus(navigator.onLine ? "ON" : "OFF");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    async function ping() {
      if (!navigator.onLine) {
        setStatus("OFF");
        return;
      }
      const start = performance.now();
      try {
        await fetch("/", { method: "HEAD", cache: "no-store" });
        const elapsed = performance.now() - start;
        setStatus(elapsed > 1200 ? "LAG" : "ON");
      } catch {
        setStatus("LAG");
      }
    }

    timerRef.current = setInterval(ping, PING_INTERVAL);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return status;
}

function useClock(): string {
  // Placeholder on first render so SSR + hydration agree; real time is set
  // on mount (the server clock would never match the client to the second).
  const [time, setTime] = useState<string>(CLOCK_PLACEHOLDER);

  useEffect(() => {
    setTime(formatTime(new Date()));
    const id = setInterval(() => setTime(formatTime(new Date())), 1_000);
    return () => clearInterval(id);
  }, []);

  return time;
}

/** Exported for unit-testing. */
export function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Exported for unit-testing. */
export type { NetStatus };

interface SegmentProps {
  label: string;
  value: string;
  tone: "ok" | "warning" | "danger" | "info" | "neutral";
}

/** Exported for unit-testing. */
export const TONE_COLOR: Record<SegmentProps["tone"], string> = {
  ok:      "text-[var(--status-ok)]",
  warning: "text-[var(--status-warning)]",
  danger:  "text-[var(--status-danger)]",
  info:    "text-[var(--status-info)]",
  neutral: "text-[var(--color-fg-muted)]",
};

function Segment({ label, value, tone }: SegmentProps) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] leading-none tracking-wider uppercase whitespace-nowrap">
      <span className="text-[var(--color-fg-subtle)]">{label}</span>
      <span className="text-[var(--color-border-strong)]">·</span>
      <span className={TONE_COLOR[tone]}>{value}</span>
    </span>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="h-2.5 w-px bg-[var(--color-border)]"
    />
  );
}

export function StatusBar() {
  const net = useNetStatus();
  const time = useClock();

  const netTone: SegmentProps["tone"] =
    net === "ON" ? "ok" : net === "LAG" ? "warning" : "danger";

  return (
    <div
      role="status"
      aria-label="System status"
      aria-live="off"
      className={clsx(
        // Desktop-only. Mobile is handled by the dot in MobileHeader.
        "hidden md:flex",
        "fixed top-0 left-0 right-0 z-50",
        "items-center gap-3 px-4",
        "h-6",
        "border-b border-[var(--color-border)]",
        "bg-[var(--color-bg)]",
      )}
    >
      <Segment label="SYS" value="OK" tone="ok" />
      <Divider />
      <Segment label="NET" value={net} tone={netTone} />
      <Divider />
      {/* SAVED is stubbed to IDLE — future: wire to a global dirty-state store */}
      <Segment label="SAVED" value="IDLE" tone="neutral" />
      <Divider />
      <Segment label="TIME" value={time} tone="neutral" />
    </div>
  );
}
