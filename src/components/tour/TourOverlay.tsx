"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/kit";
import { useCoachMarkFocus } from "@/hooks/useCoachMarkFocus";
import { cn } from "@/lib/cn";
import type { TourPlacement, TourStep } from "./steps";

/** Padding around the spotlit element, in px. */
const SPOTLIGHT_PAD = 6;
/** Gap between the target box and the tooltip card, in px. */
const CARD_GAP = 14;
/** Viewport margin the card is clamped within, in px. */
const VIEWPORT_MARGIN = 12;
/** Approx card size used to clamp before measuring (refined post-render). */
const CARD_W = 320;
const CARD_H = 200;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Placed {
  /** Spotlight box (target + padding), in viewport coords. Null = no anchor. */
  target: Rect | null;
  /** Tooltip card position (top-left), in viewport coords. */
  card: { top: number; left: number };
  /** Resolved side the card sits on (drives the arrow). */
  side: TourPlacement | "center";
}

/** Locate the live anchor for a step and compute spotlight + card positions. */
function place(
  step: TourStep,
  cardEl: HTMLElement | null,
): Placed {
  const el = document.querySelector<HTMLElement>(
    `[data-tour="${step.target}"]`,
  );
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = cardEl?.offsetWidth || CARD_W;
  const cardH = cardEl?.offsetHeight || CARD_H;

  // No anchor on this route (e.g. a nav step while the panel is collapsed on
  // mobile) → centre the card as a plain modal, no spotlight.
  if (!el) {
    return {
      target: null,
      card: {
        top: Math.max(VIEWPORT_MARGIN, vh / 2 - cardH / 2),
        left: Math.max(VIEWPORT_MARGIN, vw / 2 - cardW / 2),
      },
      side: "center",
    };
  }

  const r = el.getBoundingClientRect();
  const target: Rect = {
    top: r.top - SPOTLIGHT_PAD,
    left: r.left - SPOTLIGHT_PAD,
    width: r.width + SPOTLIGHT_PAD * 2,
    height: r.height + SPOTLIGHT_PAD * 2,
  };

  const want = step.placement ?? "right";
  // Decide a side that actually fits; fall back through a sensible order.
  const fits: Record<TourPlacement, boolean> = {
    right: r.right + CARD_GAP + cardW <= vw - VIEWPORT_MARGIN,
    left: r.left - CARD_GAP - cardW >= VIEWPORT_MARGIN,
    bottom: r.bottom + CARD_GAP + cardH <= vh - VIEWPORT_MARGIN,
    top: r.top - CARD_GAP - cardH >= VIEWPORT_MARGIN,
  };
  const order: TourPlacement[] = [
    want,
    want === "right" ? "left" : "right",
    want === "top" ? "bottom" : "top",
    want === "left" ? "right" : "left",
    "bottom",
    "top",
  ];
  const side = order.find((s) => fits[s]) ?? want;

  let top: number;
  let left: number;
  if (side === "right") {
    left = r.right + CARD_GAP;
    top = r.top + r.height / 2 - cardH / 2;
  } else if (side === "left") {
    left = r.left - CARD_GAP - cardW;
    top = r.top + r.height / 2 - cardH / 2;
  } else if (side === "bottom") {
    top = r.bottom + CARD_GAP;
    left = r.left + r.width / 2 - cardW / 2;
  } else {
    top = r.top - CARD_GAP - cardH;
    left = r.left + r.width / 2 - cardW / 2;
  }

  // Clamp inside the viewport.
  left = Math.min(Math.max(VIEWPORT_MARGIN, left), vw - cardW - VIEWPORT_MARGIN);
  top = Math.min(Math.max(VIEWPORT_MARGIN, top), vh - cardH - VIEWPORT_MARGIN);

  return { target, card: { top, left }, side };
}

export function TourOverlay({
  step,
  index,
  total,
  pathname,
  onNext,
  onBack,
  onSkip,
}: {
  step: TourStep;
  index: number;
  total: number;
  /** Re-place when the route changes (a step may anchor on another page). */
  pathname: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);

  const reposition = useCallback(() => {
    setPlaced(place(step, cardRef.current));
  }, [step]);

  // Measure synchronously after the card paints so the card's real size is
  // used for clamping (avoids a one-frame jump on the first render of a step).
  useLayoutEffect(() => {
    reposition();
    // A second pass next frame catches the case where the anchor mounts a beat
    // late (e.g. just after a route push) — cheap and idempotent.
    const id = window.requestAnimationFrame(reposition);
    return () => window.cancelAnimationFrame(id);
  }, [reposition, pathname]);

  // Keep the spotlight glued to the target through scroll + resize.
  useEffect(() => {
    function onChange() {
      reposition();
    }
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true); // capture: catch inner scrollers
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [reposition]);

  // Keyboard: Esc skips, ←/Enter/→ navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onSkip();
          break;
        case "ArrowRight":
        case "Enter":
          // Let a focused control keep its own Enter. Now that focus really
          // lands inside the card (R3-1), Enter on Skip/Back/Next would
          // otherwise fire twice — once here and once as the button's click,
          // stepping the tour twice per press.
          if (e.key === "Enter" && (e.target as HTMLElement | null)?.closest("button")) {
            return;
          }
          e.preventDefault();
          onNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          onBack();
          break;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onNext, onBack, onSkip]);

  // Modality, for real (R3-1): focus onto the card each step, Tab kept inside
  // it, focus handed back to whatever opened the tour when it closes. The card
  // claimed `aria-modal` from day one and did none of this — a real Tab
  // keypress walked out into the page it had declared inert.
  useCoachMarkFocus(cardRef, index, placed !== null);

  const target = placed?.target ?? null;
  const isFirst = index === 0;

  // One tree, whether or not the card has been measured yet: the pre-measure
  // pass used to render a DIFFERENT tree (a lone card inside an aria-hidden
  // wrapper), which meant React unmounted that card and mounted a fresh node
  // the moment placement landed — so the "focus the card" effect had focused a
  // node that no longer existed and focus was left on <body>. The `null` slots
  // below hold their positions, so the card element is the same node
  // throughout. Off-screen + transparent until placed, so it can be measured
  // without flashing.
  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dimmer with a spotlight cutout. Two strategies:
          - With a target: a hollow box-shadow ring punches a clear hole over
            the element while dimming everything else, all in one element.
          - Without a target: a plain full-screen dim. */}
      {!placed ? null : target ? (
        <div
          className="pointer-events-none absolute motion-safe:transition-all motion-safe:duration-200"
          style={{
            top: target.top,
            left: target.left,
            width: target.width,
            height: target.height,
            borderRadius: 4,
            boxShadow:
              "0 0 0 9999px rgba(0,0,0,0.72), 0 0 0 1px rgba(0,210,255,0.9), 0 0 14px 2px rgba(0,210,255,0.45)",
          }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/70" />
      )}

      {/* Click-catcher: clicking the dimmed area is a no-op (keeps the painter
          inside the tour); explicit Skip/Next/Back drive navigation. */}
      {placed ? <div className="absolute inset-0" aria-hidden="true" /> : null}

      <TooltipCard
        ref={cardRef}
        step={step}
        index={index}
        total={total}
        side={placed?.side ?? "center"}
        showArrow={Boolean(placed && target)}
        isFirst={isFirst}
        style={
          placed
            ? { top: placed.card.top, left: placed.card.left }
            : { top: -9999, left: -9999, opacity: 0 }
        }
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
      />
    </div>
  );
}

/* ---- Arrow indicator: a small cyan triangle pointing at the target ---- */
const ARROW_BASE =
  "pointer-events-none absolute h-0 w-0 border-[7px] border-transparent";
const arrowBySide: Record<TourPlacement | "center", string> = {
  // Arrow sits on the card edge nearest the target, pointing toward it.
  right: cn(ARROW_BASE, "left-[-14px] top-1/2 -translate-y-1/2 border-r-cyan"),
  left: cn(ARROW_BASE, "right-[-14px] top-1/2 -translate-y-1/2 border-l-cyan"),
  bottom: cn(ARROW_BASE, "left-1/2 top-[-14px] -translate-x-1/2 border-b-cyan"),
  top: cn(ARROW_BASE, "bottom-[-14px] left-1/2 -translate-x-1/2 border-t-cyan"),
  center: "hidden",
};

interface CardProps {
  step: TourStep;
  index: number;
  total: number;
  side: TourPlacement | "center";
  showArrow?: boolean;
  isFirst?: boolean;
  style: React.CSSProperties;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const TooltipCard = forwardRef<HTMLDivElement, CardProps>(function TooltipCard(
  { step, index, total, side, showArrow, isFirst, style, onNext, onBack, onSkip },
  ref,
) {
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`Tutorial step ${index + 1} of ${total}: ${step.title}`}
      tabIndex={-1}
      style={{ width: CARD_W, ...style }}
      className={cn(
        "absolute z-[101] border border-cyan bg-bg p-4 outline-none",
        "shadow-[0_0_24px_rgba(0,210,255,0.18),0_18px_44px_-18px_rgba(0,0,0,0.9)]",
        "motion-safe:transition-[top,left] motion-safe:duration-200",
      )}
    >
      {showArrow && <span className={arrowBySide[side]} aria-hidden="true" />}

      {/* Tech label + step counter */}
      <div className="mb-2 flex items-center justify-between">
        <span className="label-osd-h2 text-cyan-lite text-glow-cyan">{step.title}</span>
        <span className="label-osd tracking-[0.2em] text-fg-dim">
          {index + 1}/{total}
        </span>
      </div>

      <p className="font-body text-body text-fg">
        <span className="text-fg-dim">WHAT · </span>
        {step.what}
      </p>
      <p className="mt-2 font-body text-body text-fg">
        <span className="text-fg-dim">WHY · </span>
        {step.why}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-cyan/20 pt-3">
        <Button variant="tertiary" size="sm" onClick={onSkip}>
          Skip
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onBack}
            disabled={isFirst}
          >
            Back
          </Button>
          <Button
            variant={step.isFinal ? "add" : "primary"}
            size="sm"
            onClick={onNext}
          >
            {step.isFinal ? "+ Create Project" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
});
