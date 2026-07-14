"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { Button, Panel, Swatch } from "@/components/kit";
import { cn } from "@/lib/cn";
import {
  getHarmonyMeta,
  harmonyKeys,
  hexToHsl,
  hslToHex,
  type HarmonyKey,
} from "@/lib/tools/wheel/harmonies";
import {
  fillHarmonyHexes,
  harmonyNaturalSlotCount,
  harmonySlotHsl,
  type Hsl,
} from "@/lib/tools/wheel/schemeFill";
import { captionScrim, readableText } from "@/lib/color";
import type { Paint, ToolSwatch } from "@/lib/types";
import { AssignPaintMenu, type AssignedResult } from "@/components/recipe/AssignPaintMenu";
import { WheelCanvas, type WheelStop } from "./WheelCanvas";

const MIN_SLOTS = 1;
const MAX_SLOTS = 8;

interface SchemeSlot {
  id: string;
  hex: string;
  locked: boolean;
}

let slotSeq = 0;
function nextSlotId(): string {
  slotSeq += 1;
  return `slot-${slotSeq}`;
}

/**
 * Color Wheel (MM-53 / MM-29 / Wave 2). Draggable HSL wheel, hue / saturation /
 * lightness sliders driving the ACTIVE slot, a scheme of N colour slots you can
 * add / remove / lock / reorder, "Generate" to auto-fill the unlocked slots from
 * a harmony around the active slot's colour, per-swatch "assign paint", and
 * `?hex` / `?name` deep-link seeding.
 */
export function ColourWheelTool({
  closestPaint,
  rankPaints,
  onSavePalette,
  onSendToRecipe,
  onAssignPaint,
  onSwatchAssigned,
  seedHex,
}: {
  closestPaint: (hex: string) => Paint | null;
  /** DOP-013 — ranked alternative paints for a harmony swatch (CIEDE2000),
   *  beyond the single closest. Fills the right panel's lower void with the
   *  "more matches" each pick has across brands. When omitted, only the single
   *  closest paint is shown (back-compat). */
  rankPaints?: (hex: string, n: number) => Paint[];
  onSavePalette: (hexes: string[]) => void;
  /** Send the WHOLE scheme's colours to a recipe (create-or-assign chooser) —
   *  every slot's hex, in on-screen order, whether or not it has a matched
   *  paint (CIzKX: colours carry even when there's no close catalog match). */
  onSendToRecipe: (swatches: ToolSwatch[]) => void;
  /** "More matches" alternates disclosure — a quick-pick paint chip, not the
   *  labeled ASSIGN button, so it keeps its original single-click behaviour
   *  (straight to the recipe-only chooser) rather than opening the 4-option
   *  menu. Omit to hide the alternates' click affordance. */
  onAssignPaint?: (hex: string) => void;
  /** The per-slot labeled "Assign" button — opens the shared
   *  {@link AssignPaintMenu} (recipe / wishlist / owned). Omit to hide the
   *  button entirely (e.g. an embedding with no recipe context). */
  onSwatchAssigned?: (result: AssignedResult) => void;
  /** Deep-link seed (`?hex`/resolved `?name`) — sets the primary pick. */
  seedHex?: string | null;
}) {
  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(90);
  const [light, setLight] = useState(50);
  const [harmony, setHarmony] = useState<HarmonyKey>("complementary");
  const [slots, setSlots] = useState<SchemeSlot[]>(() => [
    { id: nextSlotId(), hex: hslToHex(0, 90, 50), locked: false },
  ]);
  const [activeId, setActiveId] = useState<string>(() => slots[0]!.id);
  // DOP-013 — which harmony hexes have their "more matches" alternates expanded.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  // Native HTML5 drag-reorder — which slot is mid-drag (for a subtle affordance).
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function toggleExpanded(hex: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(hex)) next.delete(hex);
      else next.add(hex);
      return next;
    });
  }

  // Seed the primary pick once from a deep-link hex, resetting the scheme to a
  // single fresh slot at that colour.
  useEffect(() => {
    if (!seedHex) return;
    const hsl = hexToHsl(seedHex);
    if (hsl) {
      setHue(hsl.h);
      setSat(hsl.s);
      setLight(Math.round(hsl.l));
      const id = nextSlotId();
      setSlots([{ id, hex: seedHex, locked: false }]);
      setActiveId(id);
    }
  }, [seedHex]);

  const activeIndex = Math.max(
    0,
    slots.findIndex((s) => s.id === activeId),
  );

  // Live wheel/slider drag updates the ACTIVE slot's colour immediately (the
  // seed-picking interaction) — unless that slot is locked, in which case the
  // wheel simply previews without writing anywhere.
  const seedHsl: Hsl = { h: hue, s: sat, l: light };
  useEffect(() => {
    const hex = hslToHex(hue, sat, light);
    setSlots((prev) =>
      prev.map((s, i) => (i === activeIndex && !s.locked ? { ...s, hex } : s)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hue, sat, light]);

  /** Fill every UNLOCKED slot from the current harmony, anchored on the active
   *  slot's HSL — the "Generate" action (and re-run when harmony changes).
   *  First auto-adds slots up to the harmony's natural swatch count (capped
   *  at MAX_SLOTS) so a single click always yields a visible multi-colour
   *  scheme instead of silently filling just 1 slot. */
  function fillScheme(nextHarmony: HarmonyKey) {
    setSlots((prev) => {
      const needed = Math.min(harmonyNaturalSlotCount(nextHarmony), MAX_SLOTS);
      let next = prev;
      if (next.length < needed) {
        const added: SchemeSlot[] = [];
        for (let i = next.length; i < needed; i++) {
          const hsl = harmonySlotHsl(nextHarmony, seedHsl, i);
          added.push({ id: nextSlotId(), hex: hslToHex(hsl.h, hsl.s, hsl.l), locked: false });
        }
        next = [...next, ...added];
      }
      return next.map((s, i) => {
        if (s.locked) return s;
        const hsl = harmonySlotHsl(nextHarmony, seedHsl, i);
        return { ...s, hex: hslToHex(hsl.h, hsl.s, hsl.l) };
      });
    });
  }

  function selectHarmony(key: HarmonyKey) {
    setHarmony(key);
    fillScheme(key);
  }

  function addSlot() {
    setSlots((prev) => {
      if (prev.length >= MAX_SLOTS) return prev;
      const hsl = harmonySlotHsl(harmony, seedHsl, prev.length);
      return [...prev, { id: nextSlotId(), hex: hslToHex(hsl.h, hsl.s, hsl.l), locked: false }];
    });
  }

  function removeSlot(id: string) {
    setSlots((prev) => {
      if (prev.length <= MIN_SLOTS) return prev;
      const next = prev.filter((s) => s.id !== id);
      if (activeId === id && next[0]) setActiveId(next[0].id);
      return next;
    });
  }

  function toggleLock(id: string) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s)));
  }

  function moveSlot(id: string, dir: -1 | 1) {
    setSlots((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  function reorderTo(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    setSlots((prev) => {
      const from = prev.findIndex((s) => s.id === draggedId);
      const to = prev.findIndex((s) => s.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }

  const stops: WheelStop[] = useMemo(
    () => [{ id: "p", hue, saturation: sat, isPrimary: true }],
    [hue, sat],
  );

  const picks = slots.map((s) => ({ ...s, paint: closestPaint(s.hex) }));

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Panel label="PICK" className="flex min-w-0 flex-col items-center gap-4 p-5">
        {/* Constrain the wheel to the column width on mobile so it never
            forces horizontal overflow (UX-002). The canvas keeps its 300px
            intrinsic size but scales down via max-w-full inside this box. */}
        <div className="relative aspect-square w-[min(100%,320px)] border border-cyan/30 p-2">
          <WheelCanvas
            size={300}
            lightness={light}
            stops={stops}
            activeId="p"
            onPrimaryChange={({ hue: h, saturation: s }) => {
              setHue(h);
              setSat(s);
            }}
          />
        </div>

        <Slider label="Hue" value={Math.round(hue)} suffix="°" min={0} max={360} onChange={setHue} />
        <Slider label="Saturation" value={Math.round(sat)} suffix="%" min={0} max={100} onChange={setSat} />
        <Slider label="Lightness" value={light} suffix="%" min={10} max={90} onChange={setLight} />

        <div className="w-full">
          <Button variant="primary" className="w-full" onClick={() => fillScheme(harmony)}>
            Generate
          </Button>
          <p className="mt-2 font-body text-body text-fg-faint">
            ▸ How it works: pick a slot count, drag the wheel to set the active
            slot&apos;s colour, hit Generate, then pick a harmony below — the rest of
            the unlocked slots fill in around it. Lock a slot to keep it fixed.
          </p>
        </div>

        <div className="w-full">
          <span className="label-osd text-fg">
            Harmony
          </span>
          <div role="radiogroup" aria-label="Harmony" className="mt-1 flex flex-col gap-1">
            {harmonyKeys.map((key) => {
              const meta = getHarmonyMeta(key);
              const preview = fillHarmonyHexes(key, seedHsl, Math.min(slots.length, 6));
              const active = key === harmony;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => selectHarmony(key)}
                  className={
                    "flex items-center gap-2 border px-2 py-1 text-left transition-colors " +
                    (active
                      ? "border-cyan bg-cyan/15"
                      : "border-cyan/20 hover:border-cyan/60 hover:bg-cyan/5")
                  }
                >
                  <span aria-hidden className="flex h-5 w-16 shrink-0 overflow-hidden border border-fg/20">
                    {preview.map((hex, i) => (
                      <span key={i} className="flex-1" style={{ backgroundColor: hex }} />
                    ))}
                  </span>
                  <span className="flex-1 truncate font-body text-body text-fg">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      <Panel label="SCHEME · CLOSEST PAINTS" cornerTicks className="flex min-w-0 flex-col gap-4 p-5">
        <div className="flex flex-col gap-2">
          {picks.map(({ id, hex, locked, paint }, i) => {
            const isActive = id === activeId;
            const isExpanded = expanded.has(hex);
            const alternates = rankPaints
              ? rankPaints(hex, 5).filter((p) => p.id !== paint?.id).slice(0, 4)
              : [];
            return (
              <div
                className={cn(
                  "flex flex-col gap-2 border p-2 transition-colors",
                  isActive ? "border-cyan bg-cyan/5" : "border-cyan/20",
                  dragOverId === id && "border-dashed border-yellow",
                )}
                key={id}
                draggable
                onDragStart={() => {
                  dragIdRef.current = id;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId(id);
                }}
                onDragLeave={() => setDragOverId((prev) => (prev === id ? null : prev))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdRef.current) reorderTo(dragIdRef.current, id);
                  dragIdRef.current = null;
                  setDragOverId(null);
                }}
              >
                <div className="flex flex-wrap items-center gap-3 gap-y-2">
                  <span
                    aria-hidden
                    title="Drag to reorder"
                    className="hidden shrink-0 cursor-grab select-none font-osd text-fg-faint sm:inline"
                  >
                    ⠿
                  </span>
                  {/* ▲/▼ are the keyboard/non-drag reorder fallback, so they get
                      full 44px hit areas (glyph unchanged) separated by 8px —
                      the hardest-to-hit accessible control shouldn't be the
                      smallest (UX-003 / MUX-001). */}
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      aria-label={`Move slot ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => moveSlot(id, -1)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center font-osd leading-none text-fg-faint hover:text-cyan-lite disabled:opacity-20"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label={`Move slot ${i + 1} down`}
                      disabled={i === slots.length - 1}
                      onClick={() => moveSlot(id, 1)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center font-osd leading-none text-fg-faint hover:text-cyan-lite disabled:opacity-20"
                    >
                      ▼
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-pressed={locked}
                    aria-label={locked ? `Unlock slot ${i + 1}` : `Lock slot ${i + 1}`}
                    onClick={() => toggleLock(id)}
                    className={cn(
                      // min-h-11 min-w-11 → 44px target (WCAG 2.2 §2.5.8) — UX-009.
                      "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center transition-colors",
                      locked ? "text-yellow" : "text-fg-faint hover:text-yellow",
                    )}
                  >
                    {locked ? <Lock size={16} aria-hidden /> : <Unlock size={16} aria-hidden />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveId(id)}
                    aria-label={`Set slot ${i + 1} as the active pick`}
                    className="inline-flex h-10 min-w-[88px] items-center justify-center border border-fg/20 px-2 font-body text-body font-bold"
                    style={{
                      backgroundColor: hex,
                      color: readableText(hex),
                      // AA scrim — keeps the caption ≥4.5:1 on saturated mid-tone
                      // reds where pure white/black text alone dips under (MUX-009).
                      textShadow: captionScrim(hex),
                    }}
                    title={hex}
                  >
                    {hex}
                  </button>
                  <span aria-hidden className="font-osd text-fg-faint">→</span>
                  {/* Paint identity stays one unit with a min width, so the Assign
                      button reflows onto its own line at ≤390px instead of
                      overlapping the brand label (UX-003). */}
                  <div className="flex min-w-[8rem] flex-1 items-center gap-3">
                    {paint ? (
                      <>
                        <Swatch hex={paint.hex} size="lg" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-body text-body text-fg">{paint.name}</div>
                          <div className="truncate label-osd text-fg">
                            {paint.brand}
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="font-body text-body text-fg">No match</span>
                    )}
                  </div>
                  {onSwatchAssigned && (
                    <AssignPaintMenu
                      swatch={{ hex, paintId: paint?.id ?? null, name: paint?.name }}
                      onAssigned={onSwatchAssigned}
                      buttonVariant="secondary"
                      buttonClassName="min-h-11 shrink-0"
                    />
                  )}
                  <button
                    type="button"
                    disabled={slots.length <= MIN_SLOTS}
                    aria-label={`Remove slot ${i + 1}`}
                    onClick={() => removeSlot(id)}
                    className="ml-auto inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center font-osd text-fg-faint hover:text-red disabled:opacity-20"
                  >
                    ✕
                  </button>
                </div>

                {/* DOP-013 — "more matches": a disclosure of the next-closest
                    paints for this slot, filling the right panel's lower void
                    with real substitutes rather than dead space. */}
                {alternates.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-cyan/10 pt-2">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(hex)}
                      className="flex min-h-11 items-center gap-1 self-start label-osd text-fg-faint hover:text-cyan-lite md:min-h-6"
                    >
                      <span aria-hidden className={cn("transition-transform", isExpanded && "rotate-90")}>
                        ▸
                      </span>
                      {isExpanded ? "Fewer matches" : `Matches (${alternates.length})`}
                    </button>
                    {isExpanded && (
                      <ul className="flex flex-wrap gap-2">
                        {alternates.map((alt) => (
                          <li key={alt.id}>
                            <button
                              type="button"
                              onClick={onAssignPaint ? () => onAssignPaint(alt.hex) : undefined}
                              disabled={!onAssignPaint}
                              title={`${alt.brand} ${alt.name} · ${alt.hex}`}
                              className={cn(
                                "flex items-center gap-2 border border-cyan/20 p-1.5 text-left",
                                onAssignPaint
                                  ? "hover:border-cyan/60 hover:bg-cyan/5"
                                  : "cursor-default",
                              )}
                            >
                              <Swatch hex={alt.hex} size="md" />
                              <span className="min-w-0">
                                <span className="block max-w-[10rem] truncate font-body text-body text-fg">
                                  {alt.name}
                                </span>
                                <span className="block truncate label-osd text-fg-faint">
                                  {alt.brand}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <span className="label-osd text-fg">Slots {slots.length}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Remove a slot"
              disabled={slots.length <= MIN_SLOTS}
              onClick={() => removeSlot(slots[slots.length - 1]!.id)}
              className="font-button text-button inline-flex min-h-11 min-w-11 items-center justify-center border border-cyan/40 text-cyan-lite hover:bg-cyan/10 disabled:opacity-30"
            >
              −
            </button>
            <button
              type="button"
              aria-label="Add a slot"
              disabled={slots.length >= MAX_SLOTS}
              onClick={addSlot}
              className="font-button text-button inline-flex min-h-11 min-w-11 items-center justify-center border border-cyan/40 text-cyan-lite hover:bg-cyan/10 disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Save Palette = +COLOR SCHEME → neon green; Send to Recipe = +RECIPE
              → pastel purple attach (9lgIwII2oBy7 / CiBUwVgwwQRD). DePixel Klein
              font kept (ruling #1). */}
          <Button variant="secondary" onClick={() => onSavePalette(slots.map((s) => s.hex))}>
            Save Palette
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              onSendToRecipe(
                slots.map((s) => ({
                  hex: s.hex,
                  paintId: closestPaint(s.hex)?.id ?? null,
                })),
              )
            }
          >
            Send to Recipe
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Slider({
  label,
  value,
  suffix,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="w-full">
      <span className="label-osd text-fg">
        {label} {value}
        {suffix}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-1 w-full accent-cyan"
      />
    </label>
  );
}

export { hslToHex };
