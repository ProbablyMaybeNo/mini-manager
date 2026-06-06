"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import {
  CLOCK_PLACEHOLDER,
  FOCUS_NONE_LABEL,
  formatClock,
  isStreakActive,
  streakUnit,
} from "@/components/statusBarHelpers";

export interface StatusBarProps {
  /** Name of the user's current Focus project, or null when none is set. */
  focusProjectName: string | null;
  /** Number of active (mid-stream) top-level projects. */
  activeProjects: number;
  /** Current painting-day streak. */
  streak: number;
}

/**
 * StatusBar — the functional top strip (DESIGN_LANGUAGE §8). Re-introduces
 * the removed StatusBar as a working HUD: a live clock, the current Focus
 * project, and quick stats (active projects / streak). It earns its space
 * — no decorative "SYS · OK" chrome.
 *
 * The numbers are computed server-side (reusing dashboardKpiHelpers /
 * plannerStreakHelpers) and passed in; only the clock is client-live.
 *
 * SSR/hydration safety: the clock renders a stable `--:--:--` placeholder
 * on the server + first client render, then swaps to the real time inside
 * an effect. Server and first-client markup match, so React never warns
 * about a hydration mismatch, and the time can't be "wrong" before mount.
 *
 * Desktop (md+): a full one-line strip across the top of the content
 * column. Mobile: collapses to a compact two-item line (clock + streak)
 * — the MobileHeader already carries the brand + search/user, so the bar
 * stays out of the way while still surfacing the most glanceable numbers.
 */
export function StatusBar({
  focusProjectName,
  activeProjects,
  streak,
}: StatusBarProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = now ? formatClock(now) : CLOCK_PLACEHOLDER;
  const streakLabel = streakUnit(streak);

  return (
    <div
      className={clsx(
        "w-full flex items-center gap-x-4 gap-y-1",
        "border-b border-[color-mix(in_srgb,var(--color-cyan)_22%,var(--color-border))]",
        "bg-[var(--color-bg-elevated)]",
        "px-3 md:px-4 py-1.5",
        "font-mono text-2xs uppercase tracking-[0.12em]",
        "text-[var(--color-fg-muted)]",
      )}
      role="status"
      aria-label="Status bar"
    >
      {/* Live clock — always shown. tabular-nums keeps it from jittering. */}
      <span className="inline-flex items-center gap-1.5 shrink-0">
        <span className="text-[var(--color-fg-subtle)]" aria-hidden>
          TIME
        </span>
        <time
          className="text-[var(--color-cyan)] tabular-nums glow-cyan"
          suppressHydrationWarning
        >
          {clock}
        </time>
      </span>

      {/* Focus project — desktop only (it can be a long name; the phone
          keeps the line lean). Links to the focus page when set. */}
      <span className="hidden md:inline-flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-[var(--color-fg-subtle)] shrink-0" aria-hidden>
          FOCUS
        </span>
        {focusProjectName ? (
          <Link
            href="/focus"
            className="truncate text-[var(--color-green)] hover:underline"
          >
            {focusProjectName}
          </Link>
        ) : (
          <Link
            href="/focus"
            className="truncate text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)]"
          >
            {FOCUS_NONE_LABEL}
          </Link>
        )}
      </span>

      {/* Quick stats — active projects (desktop) + streak (always). */}
      <span className="hidden md:inline-flex items-center gap-1.5 shrink-0">
        <span className="text-[var(--color-fg-subtle)]" aria-hidden>
          ACTIVE
        </span>
        <span className="text-[var(--color-fg)] tabular-nums">
          {activeProjects}
        </span>
      </span>

      <span className="inline-flex items-center gap-1.5 shrink-0 ml-auto md:ml-0">
        <span className="text-[var(--color-fg-subtle)]" aria-hidden>
          STREAK
        </span>
        <span
          className={clsx(
            "tabular-nums",
            isStreakActive(streak)
              ? "text-[var(--color-cyan)]"
              : "text-[var(--color-fg-muted)]",
          )}
        >
          {streak}
        </span>
        <span className="text-[var(--color-fg-subtle)]" aria-hidden>
          {streakLabel}
        </span>
      </span>
    </div>
  );
}
