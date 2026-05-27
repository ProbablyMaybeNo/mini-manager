"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { ProgressBar } from "@/components/ProgressBar";
import {
  bumpCounter,
  counterStages,
  validateBump,
  type CounterStage,
} from "@/lib/actions/counters";

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
 * Stages rendered in the main 5-row panel. Owned is broken out
 * separately above (it represents "minis on the desk" rather than
 * a hobby stage).
 */
const PANEL_STAGES = ["build", "prime", "paint", "base", "complete"] as const;
type PanelStage = (typeof PANEL_STAGES)[number];

const STAGE_LABEL: Readonly<Record<CounterStage, string>> = {
  owned: "OWNED",
  build: "BUILD",
  prime: "PRIME",
  paint: "PAINT",
  base: "BASE",
  complete: "COMPLETE",
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
}: {
  stage: PanelStage;
  value: number;
  total: number;
  isLead: boolean;
  canIncrement: boolean;
  canDecrement: boolean;
  isPending: boolean;
  onBump: (delta: 1 | -1) => void;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  const labelTone = isLead
    ? "text-[var(--color-green)]"
    : "text-[var(--color-fg-muted)]";

  return (
    <li
      className={clsx(
        "frame px-3 py-2 grid items-center gap-x-3 gap-y-2",
        "grid-cols-[5rem_1fr_auto] sm:grid-cols-[5rem_1fr_auto_auto]",
      )}
    >
      <span
        className={clsx(
          "font-mono text-xs uppercase tracking-wider",
          labelTone,
        )}
      >
        {STAGE_LABEL[stage]}
      </span>

      <span className="min-w-0 flex items-center gap-2">
        <ProgressBar percent={percent} width={20} />
        <span className="font-mono text-xs text-[var(--color-fg-muted)] whitespace-nowrap">
          {value} / {total}
        </span>
      </span>

      <span className="col-span-3 sm:col-span-2 flex items-center justify-end gap-2">
        <CounterButton
          label={`Decrement ${STAGE_LABEL[stage]}`}
          glyph="−"
          disabled={!canDecrement || isPending}
          onClick={() => onBump(-1)}
        />
        <CounterButton
          label={`Increment ${STAGE_LABEL[stage]}`}
          glyph="+"
          disabled={!canIncrement || isPending}
          onClick={() => onBump(1)}
        />
      </span>
    </li>
  );
}

export function CounterButton({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string;
  glyph: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={clsx(
        "tap-target inline-flex items-center justify-center px-3 py-1.5",
        "frame-strong font-mono text-sm leading-none select-none",
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)] hover:text-[var(--color-green)] active:bg-[color-mix(in_srgb,var(--color-green)_14%,transparent)]",
      )}
    >
      {glyph}
    </button>
  );
}

function KeyboardHint() {
  return (
    <p className="font-mono text-2xs text-[var(--color-fg-subtle)] uppercase tracking-wider hidden sm:block">
      [ B ] build · [ P ] prime · [ A ] paint · [ S ] base · [ C ] complete
      <span className="ml-2 text-[var(--color-fg-subtle)]">
        — hold Shift to decrement
      </span>
    </p>
  );
}
