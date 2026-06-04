"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { ProgressBar } from "@/components/ProgressBar";
import {
  PANEL_STAGES,
  STAGE_BAR_TONE,
  STAGE_LABEL,
  STAGE_SHORTCUT,
  STAGE_TONE,
  type PanelStage,
} from "@/components/stageCounterLabels";
import { bumpCounter, setCounter } from "@/lib/actions/counters";
import { validateBump } from "@/lib/counters/cascade";

/**
 * Snapshot of the project columns this panel cares about. We accept
 * a typed slice (not the full Project) so server pages can pass the
 * minimum amount of data and the component stays portable.
 */
export type StagePanelSnapshot = {
  id: string;
  count: number;
  ownedCount: number;
  buildCount: number;
  primeCount: number;
  paintCount: number;
  baseCount: number;
  completeCount: number;
};

/**
 * Keyboard shortcuts. `B/P/A/S/C` map to the painter's mental model:
 * Build, Prime, pAint, baSe, Complete. Each keypress is +1; hold
 * Shift for −1. Inputs and textareas always win — the handler bails
 * if focus is in any editable element.
 */
const SHORTCUT_TO_STAGE: Readonly<Record<string, PanelStage>> = {
  b: "build",
  p: "prime",
  a: "paint",
  s: "base",
  c: "complete",
};

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLSelectElement) return true;
  if (el.isContentEditable) return true;
  return false;
}

/**
 * The currently-most-advanced stage for tone. If complete > 0 it's
 * "complete"; otherwise the deepest stage with any progress.
 */
function leadStage(snap: StagePanelSnapshot): PanelStage | null {
  if (snap.completeCount > 0) return "complete";
  if (snap.baseCount > 0) return "base";
  if (snap.paintCount > 0) return "paint";
  if (snap.primeCount > 0) return "prime";
  if (snap.buildCount > 0) return "build";
  return null;
}

function stageValue(snap: StagePanelSnapshot, stage: PanelStage): number {
  switch (stage) {
    case "build":
      return snap.buildCount;
    case "prime":
      return snap.primeCount;
    case "paint":
      return snap.paintCount;
    case "base":
      return snap.baseCount;
    case "complete":
      return snap.completeCount;
  }
}

export function StageCounter({ snapshot }: { snapshot: StagePanelSnapshot }) {
  // Optimistic local state — the server action will revalidate the
  // page on success and overwrite via the next render. Keeping a
  // mirror means the buttons stay responsive during the round-trip.
  const [snap, setSnap] = useState<StagePanelSnapshot>(snapshot);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Snapshot can change when the parent re-renders after the
  // server action's revalidatePath fires. Sync local state back.
  useEffect(() => {
    setSnap(snapshot);
  }, [snapshot]);

  const lead = useMemo(() => leadStage(snap), [snap]);

  // The keyboard handler is bound once on mount; it reads the latest
  // snapshot through a ref so we don't churn listeners on every bump.
  const snapRef = useRef(snap);
  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);

  const onBump = useCallback((stage: PanelStage, delta: 1 | -1) => {
    const current = snapRef.current;
    // Pre-validate to avoid a network round-trip on illegal bumps.
    const check = validateBump(current, stage, delta);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);

    // Optimistic update.
    const col: keyof StagePanelSnapshot = `${stage}Count`;
    const prev = current;
    const optimistic = { ...prev, [col]: check.nextValue };
    setSnap(optimistic);
    snapRef.current = optimistic;

    startTransition(async () => {
      const result = await bumpCounter({
        projectId: current.id,
        stage,
        delta,
      });
      if (!result.ok) {
        setSnap(prev);
        snapRef.current = prev;
        setError(result.error);
      }
    });
  }, []);

  // M6 — tap-number-to-type: set a stage to an absolute value (fast for
  // large counts vs. holding +). Optimistic, with the same revert-on-error
  // contract as onBump.
  const onSet = useCallback((stage: PanelStage, value: number) => {
    const current = snapRef.current;
    const col: keyof StagePanelSnapshot = `${stage}Count`;
    if (current[col] === value) return;
    setError(null);
    const prev = current;
    const optimistic = { ...prev, [col]: value };
    setSnap(optimistic);
    snapRef.current = optimistic;
    startTransition(async () => {
      const result = await setCounter({ projectId: current.id, stage, value });
      if (!result.ok) {
        setSnap(prev);
        snapRef.current = prev;
        setError(result.error);
      }
    });
  }, []);

  // Page-level keyboard shortcuts. Bound once; reads fresh state
  // via snapRef inside onBump.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isEditableTarget(e.target)) return;

      const key = e.key.toLowerCase();
      const stage = SHORTCUT_TO_STAGE[key];
      if (!stage) return;

      e.preventDefault();
      const delta: 1 | -1 = e.shiftKey ? -1 : 1;
      onBump(stage, delta);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBump]);

  if (snap.count === 0) {
    return (
      <div className="frame p-4 text-xs font-mono text-[var(--color-fg-muted)]">
        This project has no rank-and-file. Aggregate counters appear when
        child units are added.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <CascadeExplainer />

      <ul className="space-y-1.5" role="list">
        {PANEL_STAGES.map((stage) => (
          <StageRow
            key={stage}
            stage={stage}
            value={stageValue(snap, stage)}
            total={snap.count}
            isLead={lead === stage}
            canIncrement={validateBump(snap, stage, 1).ok}
            canDecrement={validateBump(snap, stage, -1).ok}
            isPending={isPending}
            onBump={(d) => onBump(stage, d)}
            onSet={(v) => onSet(stage, v)}
          />
        ))}
      </ul>

      <KeyboardHint />

      {error ? (
        <p
          role="alert"
          className="frame px-3 py-2 text-xs font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function StageRow({
  stage,
  value,
  total,
  isLead,
  canIncrement,
  canDecrement,
  isPending,
  onBump,
  onSet,
}: {
  stage: PanelStage;
  value: number;
  total: number;
  isLead: boolean;
  canIncrement: boolean;
  canDecrement: boolean;
  isPending: boolean;
  onBump: (delta: 1 | -1) => void;
  onSet: (value: number) => void;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  // The lead stage gets the full per-stage colour treatment; other rows
  // sit on muted-foreground so the eye lands on "what's active right
  // now" without needing to read every label. P11.1.
  const labelTone = isLead ? STAGE_TONE[stage] : "text-[var(--color-fg-muted)]";

  // Cascade-aware tooltip on disabled +. When you can't bump higher
  // it's because the next-up stage is the ceiling — explain it.
  // (BUILD ceiling is OWNED, PRIME is BUILD, etc.) The pre-validation
  // error message already includes the limit; we steal the same string.
  const incBlockerHint = canIncrement
    ? undefined
    : nextUpHintFor(stage);

  return (
    <li
      className={clsx(
        "frame px-3 py-2 grid items-center gap-x-3 gap-y-2",
        "grid-cols-[6.5rem_1fr_auto] sm:grid-cols-[6.5rem_1fr_auto_auto]",
      )}
    >
      <span className="flex items-baseline gap-1.5 min-w-0">
        <span
          className={clsx(
            "font-mono text-xs uppercase tracking-wider",
            labelTone,
          )}
        >
          {STAGE_LABEL[stage]}
        </span>
        <kbd
          aria-label={`Keyboard shortcut: ${STAGE_SHORTCUT[stage]}`}
          className="font-mono text-2xs text-[var(--color-fg-subtle)] uppercase tracking-wider"
        >
          {STAGE_SHORTCUT[stage]}
        </kbd>
      </span>

      <span className="min-w-0 flex items-center gap-2">
        <ProgressBar percent={percent} width={20} tone={STAGE_BAR_TONE[stage]} />
        {/* M6 — tap the value to type a large count directly instead of
            holding +. */}
        <ValueEditor
          stage={stage}
          value={value}
          total={total}
          onSet={onSet}
        />
      </span>

      {/* M6 — − and + sit at OPPOSITE ENDS of the controls cluster
          (justify-between) so a thumb never fat-fingers the wrong one
          [MOBILE §M6 step 4]. The value editor + bar live in the middle
          column above. */}
      <span className="col-span-3 sm:col-span-2 flex items-center justify-between gap-2">
        <CounterButton
          label={`Decrement ${STAGE_LABEL[stage]}`}
          glyph="−"
          disabled={!canDecrement}
          onClick={() => onBump(-1)}
          repeat
        />
        <CounterButton
          label={`Increment ${STAGE_LABEL[stage]}`}
          glyph="+"
          disabled={!canIncrement}
          onClick={() => onBump(1)}
          title={incBlockerHint}
          repeat
        />
      </span>
    </li>
  );
}

/**
 * Why is + disabled on this stage? Each stage's ceiling is the
 * count of the next-up stage in the cascade (OWNED for BUILD,
 * BUILD for PRIME, etc.). Surfaces as a native `title` tooltip
 * so a hover/long-press tells the user "bump the prior stage
 * first" without firing the error block.
 */
function nextUpHintFor(stage: PanelStage): string {
  switch (stage) {
    case "build":
      return "BUILD can't exceed OWNED — bump Owned first.";
    case "prime":
      return "PRIME can't exceed BUILD — bump Build first.";
    case "paint":
      return "PAINT can't exceed PRIME — bump Prime first.";
    case "base":
      return "BASE can't exceed PAINT — bump Paint first.";
    case "complete":
      return "DONE can't exceed BASE — bump Base first.";
  }
}

export function CounterButton({
  label,
  glyph,
  disabled,
  onClick,
  title,
  repeat = false,
}: {
  label: string;
  glyph: string;
  /** True when the bump is currently illegal (e.g. capped at the
   *  next-stage ceiling). The button still receives clicks so the
   *  inline cascade error fires on attempt — see UX-902. */
  disabled: boolean;
  onClick: () => void;
  title?: string;
  /** M6 — long-press to repeat (auto-fire on hold for fast bulk bumps
   *  [MOBILE §M6 step 4]). Accelerates after the initial delay. */
  repeat?: boolean;
}) {
  // M6 — long-press repeat. Hold begins after a 400ms delay, then fires
  // every 90ms while held. Cleared on pointer-up / leave / cancel. A plain
  // click still fires onClick once (the held timers are extra).
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onClickRef = useRef(onClick);
  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  const stopHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (repeatTimer.current) {
      clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  }, []);

  useEffect(() => stopHold, [stopHold]);

  const startHold = useCallback(() => {
    if (!repeat || disabled) return;
    holdTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => onClickRef.current(), 90);
    }, 400);
  }, [repeat, disabled, stopHold]);

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={startHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      // UX-902 — keep the button clickable on a capped attempt so
      // onClick still fires and the parent's validateBump surfaces
      // the cascade error in the inline red alert. AT users see the
      // disabled state via aria-disabled; the visual treatment matches
      // a native disabled button (opacity + cursor).
      aria-disabled={disabled || undefined}
      aria-label={label}
      title={title}
      className={clsx(
        "tap-target inline-flex items-center justify-center px-3 py-1.5",
        "frame-strong font-mono text-sm leading-none select-none touch-none",
        disabled
          ? "opacity-40 cursor-not-allowed text-[var(--color-fg-subtle)]"
          : "hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] hover:text-[var(--color-accent)] active:bg-[color-mix(in_srgb,var(--color-green)_14%,transparent)]",
      )}
    >
      {glyph}
    </button>
  );
}

/**
 * M6 — tap-number-to-type value editor. Renders the `value / total`
 * readout as a button; tapping swaps in a numeric input (type="number",
 * inputmode="numeric") seeded with the current value. Enter / blur commits
 * via onSet; Escape cancels. Faster than holding + for large model counts
 * [MOBILE §M6 step 4].
 */
function ValueEditor({
  stage,
  value,
  total,
  onSet,
}: {
  stage: PanelStage;
  value: number;
  total: number;
  onSet: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft(String(value));
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, value]);

  function commit() {
    const n = Number.parseInt(draft, 10);
    setEditing(false);
    if (Number.isFinite(n) && n !== value) onSet(Math.max(0, n));
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        min={0}
        max={total}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        aria-label={`Set ${STAGE_LABEL[stage]} count`}
        className="tap-target w-16 px-1 py-0.5 frame bg-[var(--color-bg)] font-mono text-xs text-[var(--color-fg)] tabular-nums focus:outline-2 focus:outline-[var(--color-accent)]"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`${STAGE_LABEL[stage]}: ${value} of ${total}. Tap to type a value.`}
      className="tap-target font-mono text-xs text-[var(--color-fg-muted)] whitespace-nowrap hover:text-[var(--color-fg)] underline decoration-dotted decoration-[var(--color-fg-subtle)] underline-offset-2 transition-colors"
    >
      {value} / {total}
    </button>
  );
}

/**
 * Cascade explainer microcopy — sits above the rows on first encounter
 * so the painter understands what tapping +1 actually does. The cascade
 * rule (count ≥ owned ≥ build ≥ prime ≥ paint ≥ base ≥ done) is the
 * model's whole behaviour; a one-line explainer beats a help icon.
 * P11.1 — Phase 11 microcopy pass.
 */
function CascadeExplainer() {
  return (
    <p className="font-sans text-xs text-[var(--color-fg-subtle)] leading-snug">
      Each stage flows into the next. Bumping a later stage promotes models
      forward — earlier stages can&apos;t drop below where later ones sit.
    </p>
  );
}

/**
 * Keyboard hint — single dim line of plain prose explaining the
 * Shift-to-decrement modifier. Per-key annotations live inline on the
 * stage rows themselves now (small `kbd` chip next to each label), so
 * this string no longer repeats every letter in bracket-chrome.
 * P11.1 — Phase 11 bracket retirement.
 */
function KeyboardHint() {
  return (
    <p className="font-mono text-2xs text-[var(--color-fg-subtle)] uppercase tracking-wider hidden sm:block">
      Press the letter to bump &nbsp;·&nbsp; hold&nbsp;
      <kbd className="font-mono">Shift</kbd>&nbsp;to decrement
    </p>
  );
}
