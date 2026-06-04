"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";

/**
 * M4 — progressive-disclosure section for the mobile `/projects` page.
 *
 * Decisions block (2026-06-03 §1): mobile `/projects` is ONE page with
 * `▸ FOCUS` and `▸ PLANNER` as collapsed-by-default disclosure sections
 * (no `app/focus`, no mobile `app/planner`). First-viewport node count
 * stays low because a COLLAPSED section does NOT mount its (heavy) body —
 * the children are gated behind `open`, so on a phone the FocusPanel /
 * PlannerSection subtrees are absent from the DOM until the painter taps
 * the header.
 *
 * Desktop coherence: at `md+` the section is always expanded and the
 * toggle chevron is hidden — desktop never collapses these (D2 later
 * relocates FOCUS into the inspector + PLANNER to its own route, but
 * until then desktop keeps both inline and open).
 *
 * SSR-safe pattern (mirrors the library colour map's `isMobile` /
 * useDensity's bootstrap): the server + first client render are
 * desktop-first (`open = true`) so markup matches and there is no
 * hydration mismatch; an effect then reads `matchMedia` and collapses
 * the section on a phone. The brief first-paint mount of the body on
 * mobile is cheap now that the COLLECTION grid is a ~2-node canvas
 * (e7251eb) rather than 7,144 buttons.
 *
 * `headerColor` maps to the existing Card accent vars so the disclosure
 * header reads like the section's old Card header bar. No raw hex, no
 * cyan on the control, tap-target floor on the toggle.
 */

type SectionAccent = "green" | "amber";

const ACCENT_DOT: Record<SectionAccent, string> = {
  green: "bg-[var(--color-green)]",
  amber: "bg-[var(--color-amber)]",
};

interface Props {
  title: string;
  accentColor: SectionAccent;
  /** Optional one-line summary shown in the collapsed header so the
   *  painter gets a glance of the section without expanding it. */
  summary?: string;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  accentColor,
  summary,
  children,
}: Props) {
  // Desktop-first default so SSR markup === first client render (no
  // hydration mismatch). Collapsed on mobile after the effect runs.
  const [open, setOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const panelId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setIsMobile(mq.matches);
      // Collapse on phones, expand on desktop. Only forces the default
      // on breakpoint change; a user's manual toggle within a breakpoint
      // is preserved until the next change.
      setOpen(!mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Desktop is always expanded and never collapsible — the toggle is a
  // plain header there. On mobile the header is a real disclosure button.
  const collapsible = isMobile;
  const bodyMounted = open || !collapsible;

  return (
    <section
      className="frame overflow-hidden"
      aria-label={title}
    >
      <button
        type="button"
        onClick={() => collapsible && setOpen((v) => !v)}
        aria-expanded={collapsible ? open : undefined}
        aria-controls={collapsible ? panelId : undefined}
        // Non-collapsible (desktop): inert header, no pointer affordance.
        className={clsx(
          "w-full flex items-center gap-2.5 px-3 py-2.5 text-left",
          "border-b border-[var(--color-border)]",
          // M7 — visible focus ring on the disclosure toggle.
          "focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:-outline-offset-2",
          collapsible
            ? "tap-target cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]"
            : "cursor-default md:cursor-default",
        )}
      >
        <span
          aria-hidden
          className={clsx(
            "inline-block h-2.5 w-2.5 rounded-full shrink-0",
            ACCENT_DOT[accentColor],
          )}
        />
        <span className="font-mono text-sm tracking-wide uppercase text-[var(--color-fg)]">
          {title}
        </span>
        {summary ? (
          <span className="ml-2 min-w-0 truncate text-2xs font-sans text-[var(--color-fg-muted)]">
            {summary}
          </span>
        ) : null}
        {/* Chevron only on mobile (the only place the section collapses). */}
        <ChevronRight
          aria-hidden
          size={16}
          strokeWidth={2}
          className={clsx(
            "ml-auto shrink-0 text-[var(--color-fg-muted)] transition-transform duration-150 motion-reduce:transition-none md:hidden",
            open ? "rotate-90" : "rotate-0",
          )}
        />
      </button>
      {bodyMounted ? (
        <div id={panelId} className="p-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
