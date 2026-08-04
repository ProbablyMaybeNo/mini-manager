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
import { useOverlayLayer } from "@/hooks/useOverlayLayer";
import { cn } from "@/lib/cn";
import {
  PROJECT_CREATE_WALKTHROUGH,
  markWalkthroughSeen,
  type WalkthroughPlacement,
  type WalkthroughStep,
} from "./projectCreateWalkthroughData";

/**
 * First-create project walkthrough — a standalone coach-mark overlay.
 *
 * Spotlights, one at a time, the key controls of a freshly-created project
 * panel (NAME → TYPE/STATUS/PRIORITY → + Sub-project → + Paint recipe →
 * PROGRESS) with a short tooltip card and Back / Next / Skip. Dismisses on
 * Skip, the final "Got it", overlay click, or Esc — each stamps the
 * localStorage "seen" flag so it never auto-shows again.
 *
 * Visuals mirror the existing TourOverlay (cyan spotlight ring, cyan-accented
 * card) but on the V2 HEX.CODE tokens (`bg-surface` card, `border-border`,
 * JetBrains/JetBrains-mono labels). Motion rides `motion-safe:` so the global
 * prefers-reduced-motion reset snaps instantly.
 *
 * The anchor lookup is scoped to `containerRef` so it only ever targets the
 * open panel's controls, never a same-named element elsewhere on the page.
 */

/** Padding around the spotlit element, in px. */
const SPOTLIGHT_PAD = 6;
/** Gap between the target box and the tooltip card, in px. */
const CARD_GAP = 14;
/** Viewport margin the card is clamped within, in px. */
const VIEWPORT_MARGIN = 12;
/** Approx card size used to clamp before measuring (refined post-render). */
const CARD_W = 300;
const CARD_H = 150;

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
  side: WalkthroughPlacement | "center";
}

/** Locate the live anchor (scoped to `root`) and compute spotlight + card. */
function place(
  step: WalkthroughStep,
  root: HTMLElement | null,
  cardEl: HTMLElement | null,
): Placed {
  const scope: ParentNode = root ?? document;
  const el = scope.querySelector<HTMLElement>(
    `[data-walkthrough="${step.target}"]`,
  );
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = cardEl?.offsetWidth || CARD_W;
  const cardH = cardEl?.offsetHeight || CARD_H;

  // Anchor not mounted (e.g. recipes section still loading) → centre the card
  // as a plain modal so the walkthrough never dead-ends.
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

  const want = step.placement ?? "bottom";
  const fits: Record<WalkthroughPlacement, boolean> = {
    right: r.right + CARD_GAP + cardW <= vw - VIEWPORT_MARGIN,
    left: r.left - CARD_GAP - cardW >= VIEWPORT_MARGIN,
    bottom: r.bottom + CARD_GAP + cardH <= vh - VIEWPORT_MARGIN,
    top: r.top - CARD_GAP - cardH >= VIEWPORT_MARGIN,
  };
  const order: WalkthroughPlacement[] = [
    want,
    want === "top" ? "bottom" : "top",
    want === "right" ? "left" : "right",
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

  left = Math.min(Math.max(VIEWPORT_MARGIN, left), vw - cardW - VIEWPORT_MARGIN);
  top = Math.min(Math.max(VIEWPORT_MARGIN, top), vh - cardH - VIEWPORT_MARGIN);

  return { target, card: { top, left }, side };
}

export interface ProjectCreateWalkthroughProps {
  /** The panel whose controls are annotated — anchor lookup is scoped here. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Fired once when the walkthrough ends (Skip / Got it / Esc / overlay). */
  onDismiss: () => void;
}

/**
 * Layer gate (R3-1). The walkthrough arms the moment a freshly-created
 * project panel opens — which, for a brand-new account, is while the 8-step
 * dashboard tour is still running. Both declared `aria-modal="true"` and both
 * rendered, so assistive technology was told twice over that the rest of the
 * page was inert, by two elements at the same z-index with no way to tell
 * which was on top.
 *
 * Only the top layer renders. Losing means rendering NOTHING rather than
 * hiding: a hidden copy would keep its document-level Esc / arrow / Enter
 * handlers and its scroll listeners live underneath the tour, so the two
 * would have fought over the same keypresses. The walkthrough resumes the
 * instant the tour is skipped or finished — which is also the moment the
 * tour's own final step hands off to project creation.
 */
export function ProjectCreateWalkthrough(props: ProjectCreateWalkthroughProps) {
  const isTopLayer = useOverlayLayer("project-walkthrough", true);
  if (!isTopLayer) return null;
  return <ProjectCreateWalkthroughOverlay {...props} />;
}

function ProjectCreateWalkthroughOverlay({
  containerRef,
  onDismiss,
}: ProjectCreateWalkthroughProps) {
  const steps = PROJECT_CREATE_WALKTHROUGH;
  const total = steps.length;
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const step = steps[index];

  // End the walkthrough: stamp the seen flag and bubble up exactly once.
  const dismissedRef = useRef(false);
  const finish = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    markWalkthroughSeen();
    onDismiss();
  }, [onDismiss]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= total - 1) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [finish, total]);

  const back = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const reposition = useCallback(() => {
    setPlaced(place(step, containerRef.current, cardRef.current));
  }, [step, containerRef]);

  // Measure synchronously after the card paints so its real size is used for
  // clamping; a second rAF pass catches a late-mounting anchor.
  useLayoutEffect(() => {
    reposition();
    const id = window.requestAnimationFrame(reposition);
    return () => window.cancelAnimationFrame(id);
  }, [reposition]);

  // Keep the spotlight glued to the target through scroll + resize.
  useEffect(() => {
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [reposition]);

  // Keyboard: Esc dismisses, ←/Enter/→ navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          finish();
          break;
        case "ArrowRight":
        case "Enter":
          // Let a focused control keep its own Enter. Now that focus really
          // lands inside the card (R3-1), Enter on Skip/Back/Next would
          // otherwise fire twice — once here and once as the button's click.
          if (e.key === "Enter" && (e.target as HTMLElement | null)?.closest("button")) {
            return;
          }
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          back();
          break;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, back, finish]);

  // Modality, for real (R3-1) — focus onto the card per step, Tab kept inside
  // it, focus restored on close. See useCoachMarkFocus.
  useCoachMarkFocus(cardRef, index, placed !== null);

  const isFirst = index === 0;
  const isLast = index === total - 1;
  const target = placed?.target ?? null;

  // One tree, measured or not — the `null` slots hold their positions so the
  // card is the same DOM node before and after placement. It used to render a
  // different tree pre-measure, which remounted the card and left the focus
  // call pointing at a discarded node (focus stayed on <body>).
  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dimmer with a spotlight cutout (hollow box-shadow ring) over the
          target, or a plain dim when there's no anchor. */}
      {!placed ? null : target ? (
        <div
          className="pointer-events-none absolute motion-safe:transition-all motion-safe:duration-200"
          style={{
            top: target.top,
            left: target.left,
            width: target.width,
            height: target.height,
            borderRadius: 8,
            boxShadow:
              "0 0 0 9999px rgba(0,0,0,0.72), 0 0 0 1px rgba(0,210,255,0.9), 0 0 14px 2px rgba(0,210,255,0.45)",
          }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/70" />
      )}

      {/* Click-catcher: clicking the dimmed scrim dismisses the walkthrough. */}
      {placed ? (
        <button
          type="button"
          aria-label="Dismiss walkthrough"
          onClick={finish}
          className="absolute inset-0 cursor-default"
        />
      ) : null}

      <WalkthroughCard
        ref={cardRef}
        step={step}
        index={index}
        total={total}
        side={placed?.side ?? "center"}
        showArrow={Boolean(placed && target)}
        isFirst={isFirst}
        isLast={isLast}
        style={
          placed
            ? { top: placed.card.top, left: placed.card.left }
            : { top: -9999, left: -9999, opacity: 0 }
        }
        onNext={next}
        onBack={back}
        onSkip={finish}
      />
    </div>
  );
}

/* ---- Arrow indicator: a small cyan triangle pointing at the target ---- */
const ARROW_BASE =
  "pointer-events-none absolute h-0 w-0 border-[7px] border-transparent";
const arrowBySide: Record<WalkthroughPlacement | "center", string> = {
  right: cn(ARROW_BASE, "left-[-14px] top-1/2 -translate-y-1/2 border-r-cyan"),
  left: cn(ARROW_BASE, "right-[-14px] top-1/2 -translate-y-1/2 border-l-cyan"),
  bottom: cn(ARROW_BASE, "left-1/2 top-[-14px] -translate-x-1/2 border-b-cyan"),
  top: cn(ARROW_BASE, "bottom-[-14px] left-1/2 -translate-x-1/2 border-t-cyan"),
  center: "hidden",
};

interface CardProps {
  step: WalkthroughStep;
  index: number;
  total: number;
  side: WalkthroughPlacement | "center";
  showArrow?: boolean;
  isFirst: boolean;
  isLast: boolean;
  style: React.CSSProperties;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const WalkthroughCard = forwardRef<HTMLDivElement, CardProps>(
  function WalkthroughCard(
    { step, index, total, side, showArrow, isFirst, isLast, style, onNext, onBack, onSkip },
    ref,
  ) {
    return (
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Project walkthrough step ${index + 1} of ${total}: ${step.title}`}
        tabIndex={-1}
        style={{ width: CARD_W, ...style }}
        className={cn(
          "absolute z-[101] rounded-[12px] border border-border bg-surface p-4 outline-none",
          "shadow-[0_0_24px_rgba(0,210,255,0.18),0_18px_44px_-18px_rgba(0,0,0,0.9)]",
          "ring-1 ring-cyan/40 motion-safe:transition-[top,left] motion-safe:duration-200",
        )}
      >
        {showArrow && <span className={arrowBySide[side]} aria-hidden="true" />}

        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="font-mono text-[12px] font-bold uppercase tracking-wide text-cyan-lite">
            {step.title}
          </span>
          <span className="font-mono text-[11px] tracking-[0.2em] text-fg-dim">
            {index + 1}/{total}
          </span>
        </div>

        <p className="font-body text-body text-fg">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
          <Button variant="tertiary" size="sm" onClick={onSkip}>
            {isLast ? "Got it" : "Skip"}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onBack} disabled={isFirst}>
              Back
            </Button>
            <Button variant="primary" size="sm" onClick={onNext}>
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    );
  },
);
