"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Swatch } from "@/components/kit";
import { cn } from "@/lib/cn";
import { harmonies, HARMONY_SCHEMES, type HarmonyScheme } from "@/lib/color";
import type { MatchResult, Paint } from "@/lib/types";

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

/** Paint-info slide-out body — exact 3.4.1 spec (no confidence/source/redundant chip). */
export function PaintInfoPanelContent({
  paint,
  ownedCount,
  matchResults,
  similar,
  onStepOwned,
  onWishlist,
  onCopyHex,
  onAssignPaint,
}: {
  paint: Paint;
  ownedCount: number;
  matchResults: MatchResult[];
  similar: Paint[];
  onStepOwned: (delta: number) => void;
  onWishlist: () => void;
  onCopyHex: () => void;
  onAssignPaint: (paint: Paint) => void;
}) {
  const [scheme, setScheme] = useState<HarmonyScheme>("Complementary");

  return (
    <div className="flex flex-col gap-5">
      {/* Large swatch + owned state */}
      <div
        className="h-28 w-full border border-fg/20"
        style={{ backgroundColor: paint.hex }}
        aria-label={`${paint.name} swatch`}
      />
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1 label-osd",
          paint.owned ? "text-green" : "text-fg-faint",
        )}
      >
        {paint.owned ? "● Owned" : "○ Not owned"}
      </span>

      {/* DOP-015 — Library→Recipe bridge at the moment of need: assign THIS
          paint (the one you're inspecting) straight into a recipe, instead of
          only being able to assign one of its lower-down match alternatives. */}
      <Button variant="attach" size="sm" className="w-fit" onClick={() => onAssignPaint(paint)}>
        + Use in a recipe
      </Button>

      <Field label="Type">
        <span className="font-body text-body text-fg">{paint.type}</span>
      </Field>

      <Field label="Hex">
        <div className="flex items-center gap-2">
          <span className="font-body text-body uppercase text-fg">{paint.hex}</span>
          <button
            type="button"
            onClick={onCopyHex}
            aria-label="Copy hex"
            title="Copy hex"
            className="border border-green/50 p-1.5 text-green hover:bg-green/10"
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

      <Field label="Inventory">
        <div className="flex items-center gap-3">
          {/* Owned counter — labelled + tooltipped so it's clear the number is
              how many of this paint you already OWN (MM-19). */}
          <div
            className="flex items-center border border-green/50"
            title="How many of this paint you already own"
          >
            <span className="px-2 label-osd text-green">
              Owned
            </span>
            <button
              type="button"
              aria-label="Decrease owned count"
              onClick={() => onStepOwned(-1)}
              className="inline-flex min-h-6 min-w-6 items-center justify-center px-2 py-1 font-button text-button text-green hover:bg-green/10"
            >
              −
            </button>
            <span
              className="w-8 text-center font-num2 text-num2 tabular-nums text-green"
              aria-label={`Owned: ${ownedCount}`}
            >
              {ownedCount}
            </span>
            <button
              type="button"
              aria-label="Increase owned count"
              onClick={() => onStepOwned(1)}
              className="inline-flex min-h-6 min-w-6 items-center justify-center px-2 py-1 font-button text-button text-green hover:bg-green/10"
            >
              +
            </button>
          </div>
          {/* Wishlist toggle (MM-19): yellow, with a filled/active state when
              the paint is on the wishlist. onWishlist persists the toggle.
              Inactive label matches the Figma "MARK AS WANTED" CTA (UX-014). */}
          <Button
            variant="addWishlist"
            size="sm"
            aria-pressed={paint.wishlisted}
            onClick={onWishlist}
          >
            {paint.wishlisted ? "★ Wishlisted" : "+ Wishlist"}
          </Button>
        </div>
      </Field>

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
    </div>
  );
}
