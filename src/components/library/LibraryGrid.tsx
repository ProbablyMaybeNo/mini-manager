"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import type { Paint } from "@/lib/paints/types";

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
}: {
  paints: ReadonlyArray<Paint>;
  selectedPaintId: string | null;
  inventoryByPaint: ReadonlyMap<string, { ownedCount: number; isWishlisted: boolean }>;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div
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
  inventory,
}: {
  paint: Paint;
  active: boolean;
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
          style={{ background: "var(--status-ok)" }}
        />
      ) : null}
      {wishlisted ? (
        <span
          aria-hidden
          className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full border border-[var(--color-bg)]"
          style={{ background: "var(--status-wishlist)" }}
        />
      ) : null}
    </button>
  );
}

function GridFooter({ total }: { total: number }) {
  return (
    <div className="px-3 py-1.5 border-t border-[var(--color-border)] text-2xs font-mono text-[var(--color-fg-muted)] bg-[var(--color-bg-elevated)]">
      {total.toLocaleString()} paint{total === 1 ? "" : "s"}
    </div>
  );
}
