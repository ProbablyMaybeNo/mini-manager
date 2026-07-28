"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Chip, Panel, Swatch } from "@/components/kit";
import { cn } from "@/lib/cn";
import { harmonies, HARMONY_SCHEMES, type HarmonyScheme } from "@/lib/color";
import { SubscribeGateDialog } from "@/components/billing/SubscribeGateDialog";
import { useSubscriber } from "@/lib/billing/SubscriberContext";
import type { MatchResult, Paint } from "@/lib/types";

/** The tri-state the STATUS control resolves to. */
export type PaintStatus = "none" | "owned" | "wishlist";

/** Click order for the cycling STATUS button: neutral → wishlist → owned → … */
const STATUS_NEXT: Record<PaintStatus, PaintStatus> = {
  none: "wishlist",
  wishlist: "owned",
  owned: "none",
};

/** Per-state label, colour, and spoken description for the STATUS button. */
const STATUS_META: Record<PaintStatus, { label: string; described: string; className: string }> = {
  none: {
    // Resting label states the current status ("Not Owned") rather than
    // echoing the "STATUS" field heading above it — the button affordance +
    // aria-label carry the "tap to change" action. NB the cycle advances to
    // WISHLIST first, so "Mark owned" would misstate what a tap does (MUX-003).
    label: "Not Owned",
    described: "not in your collection",
    className: "border border-border bg-surface-2 text-fg-dim hover:bg-fg/5 hover:text-fg",
  },
  wishlist: {
    label: "Wishlist",
    described: "on your wishlist",
    className: "border border-yellow bg-yellow text-bg hover:bg-yellow/85",
  },
  owned: {
    label: "Owned",
    described: "owned",
    className: "border border-green bg-green text-bg hover:bg-green/85",
  },
};

/** Single cycling ownership control — one button that advances
 *  Status → Wishlist → Owned → Status on each click. Routes every change
 *  through the same `onSetStatus` the tri-state control used, so the
 *  Library↔Collection reconcile stays intact. */
function StatusCycleButton({
  status,
  onSetStatus,
}: {
  status: PaintStatus;
  onSetStatus: (status: PaintStatus) => void;
}) {
  const meta = STATUS_META[status];
  const next = STATUS_NEXT[status];
  return (
    <button
      type="button"
      onClick={() => onSetStatus(next)}
      aria-label={`Ownership status: ${meta.described}. Activating sets it to ${STATUS_META[next].label}.`}
      className={cn(
        "inline-flex min-h-11 w-fit items-center justify-center rounded-[6px] px-3 py-1 font-button text-button uppercase tracking-[0.15em] transition-colors duration-150 ease-out focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan",
        meta.className,
      )}
    >
      {meta.label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-osd text-fg">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Paint-info slide-out body (Wave 2 redesign):
 *  swatch → STATUS + HEX → TYPE → RECIPE (use-in-recipe + chips) →
 *  harmonies / match / similar. */
export function PaintInfoPanelContent({
  paint,
  recipesForPaint,
  matchResults,
  similar,
  onSetStatus,
  onCopyHex,
  onAssignPaint,
}: {
  paint: Paint;
  /** Recipes owned by the user that pin this paint — one chip each. */
  recipesForPaint: { id: string; name: string }[];
  matchResults: MatchResult[];
  similar: Paint[];
  onSetStatus: (status: PaintStatus) => void;
  onCopyHex: () => void;
  onAssignPaint: (paint: Paint) => void;
}) {
  const isSubscriber = useSubscriber();
  const [gateOpen, setGateOpen] = useState(false);
  const [scheme, setScheme] = useState<HarmonyScheme>("Complementary");

  const status: PaintStatus = paint.owned
    ? "owned"
    : paint.wishlisted
      ? "wishlist"
      : "none";

  return (
    <div className="flex flex-col gap-5">
      {/* Large swatch */}
      <div
        className="h-28 w-full border border-fg/20"
        style={{ backgroundColor: paint.hex }}
        aria-label={`${paint.name} swatch`}
      />

      {/* STATUS (left) + HEX (right) on one row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Field label="Status">
          <StatusCycleButton status={status} onSetStatus={onSetStatus} />
        </Field>

        <Field label="Hex">
          <div className="flex items-center gap-2">
            <span className="font-body text-body uppercase text-fg">{paint.hex}</span>
            <button
              type="button"
              onClick={onCopyHex}
              aria-label="Copy hex"
              title="Copy hex"
              className="inline-flex min-h-11 min-w-11 items-center justify-center border border-green/50 text-green hover:bg-green/10"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <rect x="9" y="9" width="11" height="11" />
                <path d="M5 15V4h11" />
              </svg>
            </button>
          </div>
        </Field>
      </div>

      <Field label="Type">
        <span className="font-body text-body text-fg">{paint.type}</span>
      </Field>

      {/* RECIPE — assign this paint + chips for the recipes already using it. */}
      <Field label="Recipe">
        <Button
          variant="attach"
          size="sm"
          className="w-fit"
          onClick={() => onAssignPaint(paint)}
        >
          + Use in a recipe
        </Button>
        {recipesForPaint.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recipesForPaint.map((r) => (
              <Link
                key={r.id}
                href={`/recipes/${r.id}`}
                className="transition-opacity hover:opacity-80"
                title={`Open recipe ${r.name}`}
              >
                <Chip accent="green">{r.name}</Chip>
              </Link>
            ))}
          </div>
        )}
      </Field>

      {isSubscriber ? (
        <>
          <Field label="Harmonies">
            <select
              value={scheme}
              onChange={(e) => setScheme(e.target.value as HarmonyScheme)}
              aria-label="Harmony scheme"
              className="border border-cyan/50 bg-bg px-2 py-1 font-body text-body text-fg focus:border-cyan focus:outline-none"
            >
              {HARMONY_SCHEMES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="mt-2 flex gap-1">
              {harmonies(paint.hex, scheme).map((hex, i) => (
                <Swatch key={`${hex}-${i}`} hex={hex} size="lg" />
              ))}
            </div>
            {/* DOP-015 — Library→Wheel bridge at the moment of need: jump to the
                full Color Wheel seeded with this paint's hex to explore the harmony
                interactively + match every leg to real paints. */}
            <Link
              href={`/tools/wheel?hex=${encodeURIComponent(paint.hex)}`}
              className="mt-2 inline-flex w-fit items-center gap-1 label-osd text-cyan-lite hover:text-glow-cyan"
            >
              ◑ Open in Color Wheel →
            </Link>
          </Field>

          <Field label="Match — closest across brands">
            <ul className="flex flex-col gap-1.5">
              {matchResults.map((m) => (
                <li key={m.paint.id} className="flex items-center gap-2">
                  <Swatch hex={m.paint.hex} size="sm" />
                  <span className="flex-1 truncate font-body text-body text-fg">
                    {m.paint.name} · {m.paint.brand}
                  </span>
                  <span className="font-num2 text-num2 tabular-nums text-fg">
                    Δ{m.distanceScore.toFixed(1)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAssignPaint(m.paint)}
                    className="inline-flex min-h-11 items-center border border-cyan/50 px-2 font-button text-button uppercase text-cyan-lite hover:bg-cyan/10"
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
          </Field>

          <Field label="Similar in other brands">
            <ul className="flex flex-col gap-1.5">
              {similar.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Swatch hex={p.hex} size="sm" />
                  <span className="flex-1 truncate font-body text-body text-fg">
                    {p.name} · {p.brand}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAssignPaint(p)}
                    className="inline-flex min-h-11 items-center border border-cyan/50 px-2 font-button text-button uppercase text-cyan-lite hover:bg-cyan/10"
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
          </Field>
        </>
      ) : (
        // Non-subscriber — the power section (harmonies/matching/colour
        // science) is HIDDEN, not greyed out, in favour of one tidy unlock
        // card (docs/SUBSCRIPTION_PAYWALL.md — greying a wall of dead
        // controls reads as broken).
        // The padding lives on the BUTTON, not the Panel (paywall audit
        // MUX-P02). With `p-4` on the Panel the card looked like a 342×54
        // tappable surface while only the inner 308×20 text line was live —
        // hit-testing five points inside the visible card, three landed on the
        // wrapping div and did nothing. Tapping the obvious edge of an unlock
        // card and getting silence is the worst first impression of a paid
        // feature.
        <Panel accent="cyan">
          <button
            type="button"
            onClick={() => setGateOpen(true)}
            className="flex min-h-12 w-full items-center justify-between gap-2 p-4 text-left font-body text-body text-cyan-lite transition-colors hover:bg-cyan/10 hover:text-glow-cyan"
          >
            <span>🔒 Sponsor to unlock a range of tools · $3.99/mo</span>
            <span aria-hidden>→</span>
          </button>
        </Panel>
      )}
      <SubscribeGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />
    </div>
  );
}
