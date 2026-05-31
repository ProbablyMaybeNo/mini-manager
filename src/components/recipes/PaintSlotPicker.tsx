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
import { updateStep } from "@/lib/actions/recipeSteps";
import { Button } from "@/components/ui/Button";

interface OwnedSet {
  /** Paint ids the painter currently owns (ownedCount > 0). */
  ownedIds: ReadonlySet<string>;
}

interface Props {
  stepId: string;
  /** Currently selected paint id (null if step is using a custom hex). */
  currentPaintId: string | null;
  /** Currently selected custom hex (null if step is using a paint). */
  currentHex: string | null;
  /** Anchor — popover positions itself relative to this. */
  anchorClassName?: string;
  /** Called after a successful save so the parent can close. */
  onClose: () => void;
  /** Optimistic patch fired before the server confirms. */
  onPatchPreview?: (patch: {
    paintId: string | null;
    customColorHex: string | null;
    swatchHex: string | null;
  }) => void;
  inventory?: OwnedSet;
}

const MAX_RESULTS = 200;

/**
 * The Library finally meets a Recipe. Compact popover: search + brand
 * dropdown + type chips + owned-only toggle, then a scrollable list of
 * paints. Custom hex mode lives in a bottom drawer. Closes only on
 * Escape, paint selected, or custom hex confirmed — accidental
 * outside-clicks within the editor are ignored.
 */
export function PaintSlotPicker({
  stepId,
  currentPaintId,
  currentHex,
  onClose,
  onPatchPreview,
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
  const [mode, setMode] = useState<"library" | "hex">(
    currentHex ? "hex" : "library",
  );
  const [hexDraft, setHexDraft] = useState<string>(currentHex ?? "#");
  const [hexError, setHexError] = useState<string | null>(null);
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
    onPatchPreview?.({
      paintId: paint.id,
      customColorHex: null,
      swatchHex: paint.hex,
    });
    startTransition(async () => {
      const result = await updateStep({
        id: stepId,
        paintId: paint.id,
        customColorHex: null,
      });
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  };

  const handleConfirmHex = () => {
    setHexError(null);
    const trimmed = hexDraft.trim();
    const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(
      trimmed,
    );
    if (!match) {
      setHexError("Hex must be #RGB, #RRGGBB, or #RRGGBBAA");
      return;
    }
    onPatchPreview?.({
      paintId: null,
      customColorHex: trimmed,
      swatchHex: trimmed,
    });
    startTransition(async () => {
      const result = await updateStep({
        id: stepId,
        paintId: null,
        customColorHex: trimmed,
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
      className="absolute z-50 mt-2 w-[360px] max-w-[calc(100vw-1.5rem)] frame-strong bg-[var(--color-bg-panel)] shadow-xl"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-1 px-2 py-2 border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setMode("library")}
          className={clsx(
            "px-2 py-1 text-2xs font-mono uppercase tracking-wider tap-target rounded-sm",
            mode === "library"
              ? "text-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"
              : "text-[var(--color-fg-muted)]",
          )}
          aria-pressed={mode === "library"}
        >
          Library
        </button>
        <button
          type="button"
          onClick={() => setMode("hex")}
          className={clsx(
            "px-2 py-1 text-2xs font-mono uppercase tracking-wider tap-target rounded-sm",
            mode === "hex"
              ? "text-[var(--color-cyan)] bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]"
              : "text-[var(--color-fg-muted)]",
          )}
          aria-pressed={mode === "hex"}
        >
          Custom hex
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="text-2xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-2"
          aria-label="Close picker"
        >
          ×
        </button>
      </div>

      {mode === "library" ? (
        <div className="p-3 space-y-3">
          <input
            type="search"
            placeholder="Search paints…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            className="block w-full px-2 py-1.5 font-mono text-xs bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-accent)]"
          />
          <div className="flex items-center gap-2">
            <select
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              className="flex-1 min-w-0 px-2 py-1.5 font-mono text-xs bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-accent)]"
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
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
              {ownedOnly ? "[x]" : "[ ]"} Owned
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
      ) : (
        <div className="p-3 space-y-3">
          <label
            htmlFor={`${id}-hex`}
            className="block section-title mb-0 pb-0 border-0"
          >
            Custom hex
          </label>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block w-10 h-10 rounded-sm border"
              style={{
                background: /^#([0-9a-fA-F]{3,8})$/.test(hexDraft.trim())
                  ? hexDraft.trim()
                  : "var(--color-bg-elevated)",
                borderColor: "var(--color-border-strong)",
              }}
            />
            <input
              id={`${id}-hex`}
              type="text"
              value={hexDraft}
              onChange={(event) => {
                let next = event.target.value.trim();
                if (next.length > 0 && !next.startsWith("#")) next = `#${next}`;
                setHexDraft(next);
              }}
              maxLength={9}
              placeholder="#0e4a8a"
              className="flex-1 px-2 py-1.5 font-mono text-xs bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-cyan)]"
            />
          </div>
          {hexError ? (
            <p role="alert" className="text-2xs font-mono text-[var(--color-red)]">
              {hexError}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-2xs font-mono text-[var(--color-red)]">
              {error}
            </p>
          ) : null}
          <p className="text-2xs font-sans text-[var(--color-fg-muted)]">
            Use this when the step is a mix or you can't find the paint in
            the library. Accepts #RGB, #RRGGBB, or #RRGGBBAA.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleConfirmHex}
              disabled={isPending}
              variant="primary"
              size="sm"
            >
              {isPending ? "Saving…" : "Use hex"}
            </Button>
            <Button
              type="button"
              onClick={() => setMode("library")}
              variant="ghost"
              size="sm"
            >
              ← Library
            </Button>
          </div>
        </div>
      )}
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
