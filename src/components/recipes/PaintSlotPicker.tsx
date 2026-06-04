"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { clsx } from "clsx";
import type { Paint, PaintType } from "@/lib/paints/types";
import { paintTypes } from "@/lib/paints/types";
import { loadPaints } from "@/lib/paints/loader";
import {
  filterByBrand,
  filterByText,
  filterByType,
} from "@/lib/paints/filters";
import { updateSlot } from "@/lib/actions/recipeSlots";
import { FilterChip } from "@/components/ui/FilterChip";

interface OwnedSet {
  /** Paint ids the painter currently owns (ownedCount > 0). */
  ownedIds: ReadonlySet<string>;
}

interface Props {
  /** The slot being edited. Null when the host owns the write (add path)
   *  and just wants the picked paint id via `onPick`. */
  slotId: string | null;
  /** Currently selected paint id (null when none / custom hex). */
  currentPaintId: string | null;
  /** Called after a successful save so the parent can close. */
  onClose: () => void;
  /** When set, the host handles persistence: the picker fires `onPick`
   *  with the chosen paint id instead of calling `updateSlot` itself.
   *  Used by the add-slot path and the slot editor side panel. */
  onPick?: (paintId: string) => void;
  /** Render inline (inside a host drawer) rather than as an absolute
   *  popover. */
  embedded?: boolean;
  inventory?: OwnedSet;
}

const MAX_RESULTS = 200;

/**
 * The Library finally meets a Recipe. Compact popover: search + brand
 * filter chips + type chips + owned-only toggle, then a scrollable list
 * of paints. Closes only on Escape or a paint being selected —
 * accidental outside-clicks within the editor are ignored.
 *
 * B2 — a recipe slot can only hold an actual catalog paint, so the old
 * custom-hex add path was removed. Custom-hex swatches may still
 * DISPLAY on legacy steps elsewhere, but they can't be ADDED here.
 */
export function PaintSlotPicker({
  slotId,
  currentPaintId,
  onClose,
  onPick,
  embedded = false,
  inventory,
}: Props) {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [paints, setPaints] = useState<ReadonlyArray<Paint>>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string>("");
  const [types, setTypes] = useState<ReadonlySet<PaintType>>(new Set());
  const [ownedOnly, setOwnedOnly] = useState<boolean>(
    Boolean(inventory?.ownedIds.size),
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Load the catalog once on mount.
  useEffect(() => {
    let mounted = true;
    loadPaints()
      .then((rows) => {
        if (mounted) setPaints(rows);
      })
      .catch(() => {
        if (mounted) setError("Couldn't load the paint catalog.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Escape-to-close.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const p of paints) set.add(p.brand);
    return Array.from(set).sort();
  }, [paints]);

  const filtered = useMemo(() => {
    let out = paints.slice();
    if (brand) out = filterByBrand(out, [brand]);
    if (types.size > 0) out = filterByType(out, Array.from(types));
    if (query) out = filterByText(out, query);
    if (ownedOnly && inventory) {
      out = out.filter((p) => inventory.ownedIds.has(p.id));
    }
    return out.slice(0, MAX_RESULTS);
  }, [paints, brand, types, query, ownedOnly, inventory]);

  const handlePickPaint = (paint: Paint) => {
    // Host-owned write path (add slot / editor side panel): hand the
    // chosen paint id up and let the host call the action.
    if (onPick) {
      onPick(paint.id);
      return;
    }
    // Self-owned write path: persist directly to the slot.
    if (!slotId) {
      setError("No slot to update.");
      return;
    }
    startTransition(async () => {
      const result = await updateSlot({
        id: slotId,
        paintId: paint.id,
      });
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  };

  const toggleType = useCallback((t: PaintType) => {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Pick paint"
      className={clsx(
        "frame-strong bg-[var(--color-bg-panel)] shadow-xl",
        embedded
          ? "w-full"
          : "absolute z-50 mt-2 w-[360px] max-w-[calc(100vw-1.5rem)]",
      )}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--color-border)]">
        <span className="flex-1 text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
          Pick a paint
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-2xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-2"
          aria-label="Close picker"
        >
          ×
        </button>
      </div>

      <div className="p-3 space-y-3">
        <input
          type="search"
          placeholder="Search paints…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
          className="block w-full px-2 py-1.5 font-mono text-xs bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-accent)]"
        />

        {/* B3 — brand filter chips. Reuses the FilterChip primitive +
            the All/value chip-row pattern from WishlistFilters so the
            painter can narrow the library to one paint company. The
            row scrolls horizontally when there are more brands than
            fit a single line. */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
            Brand
          </span>
          <div className="flex gap-1.5 overflow-x-auto">
            <FilterChip
              active={brand === ""}
              onClick={() => setBrand("")}
              className="shrink-0"
            >
              All
            </FilterChip>
            {brands.map((b) => (
              <FilterChip
                key={b}
                active={brand === b}
                onClick={() => setBrand(brand === b ? "" : b)}
                className="shrink-0"
              >
                {b}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end">
          <label
            htmlFor={`${id}-owned`}
            className={clsx(
              "inline-flex items-center gap-1.5 text-2xs font-mono uppercase tracking-wider cursor-pointer tap-target px-2",
              ownedOnly
                ? "text-[var(--color-green)]"
                : "text-[var(--color-fg-muted)]",
            )}
          >
            <input
              id={`${id}-owned`}
              type="checkbox"
              checked={ownedOnly}
              onChange={(event) => setOwnedOnly(event.target.checked)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={clsx(
                "inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm border font-mono text-2xs leading-none",
                ownedOnly
                  ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_24%,transparent)] text-[var(--color-accent)]"
                  : "border-[var(--color-border-strong)]",
              )}
            >
              {ownedOnly ? "✓" : ""}
            </span>
            Owned only
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {paintTypes.slice(0, 7).map((t) => {
            const active = types.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={clsx(
                  "px-2 py-0.5 text-2xs font-mono uppercase tracking-wider frame tap-target",
                  active
                    ? "border-[var(--color-cyan)] text-[var(--color-cyan)]"
                    : "text-[var(--color-fg-muted)]",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>

        {error ? (
          <p
            role="alert"
            className="text-2xs font-mono text-[var(--color-red)]"
          >
            {error}
          </p>
        ) : null}

        <div
          role="listbox"
          aria-label="Paints"
          className="max-h-[55vh] sm:max-h-[280px] overflow-y-auto frame divide-y divide-[var(--color-border)]"
        >
          {loading ? (
            <p className="px-3 py-3 text-xs font-mono text-[var(--color-fg-muted)]">
              Loading catalog…
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs font-mono text-[var(--color-fg-muted)]">
              No paints match.
            </p>
          ) : (
            filtered.map((p) => (
              <PaintRow
                key={p.id}
                paint={p}
                selected={p.id === currentPaintId}
                isPending={isPending}
                onPick={() => handlePickPaint(p)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PaintRow({
  paint,
  selected,
  isPending,
  onPick,
}: {
  paint: Paint;
  selected: boolean;
  isPending: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      disabled={isPending}
      className={clsx(
        "w-full flex items-center gap-2 px-3 py-1.5 text-left tap-target",
        selected
          ? "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"
          : "hover:bg-[color-mix(in_srgb,var(--color-fg)_3%,transparent)]",
        isPending && "opacity-60 cursor-progress",
      )}
    >
      <span
        aria-hidden
        className="inline-block w-5 h-5 rounded-sm border shrink-0"
        style={{
          background: paint.hex,
          borderColor: "var(--color-border-strong)",
        }}
      />
      <span className="flex-1 min-w-0">
        <span className="block font-mono text-xs truncate text-[var(--color-fg)]">
          {paint.brand} {paint.name}
        </span>
        <span className="block text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider">
          {paint.line ?? paint.type}
        </span>
      </span>
    </button>
  );
}
