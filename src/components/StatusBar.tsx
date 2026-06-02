"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

/* ============================================================
   StatusBar — phosphor terminal chrome bar.

   Pinned to the viewport top on desktop (hidden on mobile where
   MobileHeader already shows the online dot). Three segments:
     SYS: OK / ERR        — always green on a working browser
     NET: ON / LAG / OFF  — navigator.onLine + periodic ping
     TIME: HH:MM:SS live clock

   SAVED was previously stubbed to IDLE — removed until a global
   dirty-state store exists. Re-add once that ships.

   Each segment is a StatusPill-style token span, coloured via
   semantic status tokens. All text mono all-caps to match the
   Terminal_UI CRT aesthetic.
   ============================================================ */

type NetStatus = "ON" | "LAG" | "OFF";

/**
 * P15.4 — semantic tone + label for each NET state. Exported (with the
 * tooltip + value helpers) so the contract is unit-testable without a DOM.
 *
 * OFF is intentionally `warning` (amber), NOT `danger` (red): with the
 * service-worker offline-reads cache live, going offline is a degraded-but-
 * usable state (cached library/catalog still readable), not a hard failure.
 * Amber matches the "OFFLINE — cached data" framing in the plan.
 */
export const NET_TONE: Record<NetStatus, "ok" | "warning" | "danger"> = {
  ON: "ok",
  LAG: "warning",
  OFF: "warning",
};

/** Display label per NET state. OFF reads as the fuller "OFFLINE". */
export const NET_LABEL: Record<NetStatus, string> = {
  ON: "ON",
  LAG: "LAG",
  OFF: "OFFLINE",
};

/** Ping interval in ms. Keep it low-cost — just HEAD the origin. */
const PING_INTERVAL = 15_000;

/**
 * UX-1002 — LAG threshold. Bumped from 1200ms to 2000ms because Vercel
 * free-tier cold starts routinely take ~1.3-1.8s and were flashing amber
 * on otherwise-healthy sessions. The UX-911 tooltip already reassures
 * users their work is saving, but the flash itself was misleading.
 * Exported for unit-testing.
 */
export const LAG_THRESHOLD_MS = 2000;

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
        setStatus(elapsed > LAG_THRESHOLD_MS ? "LAG" : "ON");
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
  /** UX-911 — optional native + AT tooltip. When set, the segment
   *  wraps its value in a span with title= AND aria-label= so both
   *  hover-by-mouse and screen-reader users see the same copy. */
  tooltip?: string;
  /** UX-1309 — for the live clock: the value transitions from the SSR
   *  placeholder to the real time on mount, which is the one node whose
   *  text legitimately differs post-hydration. suppressHydrationWarning
   *  keeps that node from being flagged as a React hydration mismatch. */
  suppressHydrationWarning?: boolean;
}

/** Exported for unit-testing. */
export const TONE_COLOR: Record<SegmentProps["tone"], string> = {
  ok:      "text-[var(--status-ok)]",
  warning: "text-[var(--status-warning)]",
  danger:  "text-[var(--status-danger)]",
  info:    "text-[var(--status-info)]",
  neutral: "text-[var(--color-fg-muted)]",
};

/**
 * UX-911 — Tooltip copy for each NET state. Recruits seeing NET LAG
 * flash amber would worry their save just failed; the tooltip
 * explicitly reassures them that the request is still in-flight.
 *
 * P15.4 — the offline (OFF) copy now leads with "OFFLINE — cached data":
 * with the service-worker offline-reads cache live, the library/catalog stay
 * readable while disconnected, so OFF is no longer a dead-end. We still warn
 * that writes won't save until reconnect.
 *
 * Exported for unit-testing.
 */
export const NET_TOOLTIP: Record<NetStatus, string> = {
  ON: "Connected — server responding normally.",
  LAG: "Server's responding slower than usual. Your work is still saving.",
  OFF: "OFFLINE — cached data. You can still browse what's loaded; changes won't save until you reconnect.",
};

function Segment({ label, value, tone, tooltip, suppressHydrationWarning }: SegmentProps) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] leading-none tracking-wider uppercase whitespace-nowrap">
      <span className="text-[var(--color-fg-subtle)]">{label}</span>
      {/* UX-1211 — decorative separator. Was --color-border-strong
          (2.87:1, below AA); raised to --color-fg-muted and aria-hidden
          since it carries no unique meaning. */}
      <span aria-hidden className="text-[var(--color-fg-muted)]">·</span>
      {tooltip ? (
        <span
          className={TONE_COLOR[tone]}
          title={tooltip}
          aria-label={`${label} ${value} — ${tooltip}`}
          suppressHydrationWarning={suppressHydrationWarning}
        >
          {value}
        </span>
      ) : (
        <span className={TONE_COLOR[tone]} suppressHydrationWarning={suppressHydrationWarning}>
          {value}
        </span>
      )}
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

  const netTone: SegmentProps["tone"] = NET_TONE[net];

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
      <Segment
        label="NET"
        value={NET_LABEL[net]}
        tone={netTone}
        tooltip={NET_TOOLTIP[net]}
      />
      <Divider />
      <Segment label="TIME" value={time} tone="neutral" suppressHydrationWarning />
    </div>
  );
}
