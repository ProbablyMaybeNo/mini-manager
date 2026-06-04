"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import type { Paint } from "@/lib/paints/types";
import { nearestVisibleIndex } from "@/lib/library/scrollTarget";

/**
 * Dense wall-of-color view. Each cell is a pure swatch; identification
 * comes from the native title tooltip on hover (also satisfies a11y +
 * works on touch via long-press). Selection click opens the same
 * PaintDetailPanel as the list view by setting `?paint=ID` in the URL.
 *
 * No bespoke virtualization here — relies on `content-visibility: auto`
 * per cell so the browser skips paint+layout for offscreen swatches.
 * Handles the current ~6k paint catalog comfortably; revisit if Ross
 * pulls another vendor and we cross 15k.
 */
export function LibraryGrid({
  paints,
  selectedPaintId,
  inventoryByPaint,
  scrollToPaintId,
  scrollToPaint,
  scrollNonce,
}: {
  paints: ReadonlyArray<Paint>;
  selectedPaintId: string | null;
  inventoryByPaint: ReadonlyMap<string, { ownedCount: number; isWishlisted: boolean }>;
  /** LIB-COLORMAP — colour-map scroll target (see LibraryTable). */
  scrollToPaintId?: string | null;
  scrollToPaint?: Paint | null;
  scrollNonce?: number;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [flashPaintId, setFlashPaintId] = useState<string | null>(null);

  // LIB-COLORMAP — scroll the swatch wall to a colour-map pick. The grid
  // isn't virtualised (content-visibility per cell), so we resolve the
  // target paint (exact, or nearest in-list by hue) and scroll its swatch
  // into view via its data-paint-id, then flash it.
  useEffect(() => {
    if (!scrollToPaintId || scrollNonce == null) return;
    const container = scrollRef.current;
    if (!container) return;
    const targetIndex = nearestVisibleIndex(paints, scrollToPaintId, scrollToPaint);
    if (targetIndex < 0) return;
    const target = paints[targetIndex];
    if (!target) return;
    const el = container.querySelector<HTMLElement>(
      `[data-paint-id="${cssAttrEscape(target.id)}"]`,
    );
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "auto" });
    }
    setFlashPaintId(target.id);
    const timer = setTimeout(() => setFlashPaintId(null), 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollNonce]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-2"
        role="grid"
        aria-rowcount={Math.ceil(paints.length / 8)}
        aria-label="Paint swatches"
      >
        {paints.length === 0 ? (
          <div className="p-8 text-center text-sm font-mono text-[var(--color-fg-muted)]">
            No paints match the current filters.
          </div>
        ) : (
          <div
            className={clsx(
              "grid gap-1.5",
              "grid-cols-[repeat(auto-fill,minmax(64px,1fr))]",
              "md:grid-cols-[repeat(auto-fill,minmax(80px,1fr))]",
            )}
          >
            {paints.map((paint) => (
              <SwatchCell
                key={paint.id}
                paint={paint}
                active={paint.id === selectedPaintId}
                flash={paint.id === flashPaintId}
                inventory={inventoryByPaint.get(paint.id)}
              />
            ))}
          </div>
        )}
      </div>
      <GridFooter total={paints.length} />
    </div>
  );
}

function SwatchCell({
  paint,
  active,
  flash,
  inventory,
}: {
  paint: Paint;
  active: boolean;
  /** LIB-COLORMAP — transient highlight after a colour-map scroll-to. */
  flash: boolean;
  inventory: { ownedCount: number; isWishlisted: boolean } | undefined;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  const owned = (inventory?.ownedCount ?? 0) > 0;
  const wishlisted = inventory?.isWishlisted ?? false;

  function openDetail() {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("paint", paint.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail();
    }
  }

  return (
    <button
      type="button"
      data-paint-id={paint.id}
      onClick={openDetail}
      onKeyDown={onKeyDown}
      role="gridcell"
      aria-current={active ? "true" : undefined}
      aria-label={`${paint.name} — ${paint.brand} ${paint.hex}`}
      title={`${paint.name}\n${paint.brand}${paint.line ? ` · ${paint.line}` : ""}\n${paint.hex.toUpperCase()}`}
      className={clsx(
        "relative aspect-square rounded-sm border transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg)]",
        active
          ? "border-[var(--color-accent)] shadow-[0_0_0_2px_var(--color-accent)]"
          : "border-[var(--color-border)] hover:border-[var(--color-accent)] hover:scale-[1.06] hover:z-10",
        // LIB-COLORMAP — transient flash when the colour map scrolls here.
        flash &&
          "animate-[pulse_0.6s_ease-in-out_2] ring-2 ring-[var(--color-amber)] z-10 motion-reduce:animate-none",
      )}
      style={{
        background: paint.hex,
        contentVisibility: "auto",
        containIntrinsicSize: "80px 80px",
      }}
    >
      {owned ? (
        <span
          aria-hidden
          className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full border border-[var(--color-bg)]"
          style={{
            background: "var(--status-ok)",
            boxShadow: "0 0 0 1.5px var(--color-bg)",
          }}
        />
      ) : null}
      {wishlisted ? (
        <span
          aria-hidden
          className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full border border-[var(--color-bg)]"
          style={{
            background: "var(--status-wishlist)",
            boxShadow: "0 0 0 1.5px var(--color-bg)",
          }}
        />
      ) : null}
    </button>
  );
}

/** Escape a paint id for safe use inside a [data-paint-id="..."] selector.
 *  Paint ids are slug-like but we quote-escape defensively. */
function cssAttrEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function GridFooter({ total }: { total: number }) {
  return (
    <div className="px-3 py-1.5 border-t border-[var(--color-border)] text-2xs font-mono text-[var(--color-fg-muted)] bg-[var(--color-bg-elevated)]">
      {total.toLocaleString()} paint{total === 1 ? "" : "s"}
    </div>
  );
}
