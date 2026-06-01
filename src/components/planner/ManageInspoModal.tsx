"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import {
  deleteInspoImage,
  reorderInspoImages,
  toggleInspoDisplay,
} from "@/lib/actions/inspoImages";
import type { InspoImage } from "@/db/schema";

/**
 * P14.7 — Manage Inspo modal.
 *
 * Shows the painter's full inspo set (including hidden), one row per
 * image with:
 *   - thumbnail (the <img> itself — no proxy)
 *   - URL + alt text
 *   - show/hide toggle (Button — solid-fill discipline)
 *   - delete (danger variant)
 *   - drag handle to reorder
 *
 * Drag-to-reorder is implemented with native HTML5 drag-and-drop —
 * minimal dependency footprint, works on desktop. On mobile the
 * touch interaction is "delete + re-add" because mobile HTML5 DnD
 * is unreliable; the rows still show in their order so the painter
 * can see the current state. We update the server with the new
 * ordering via `reorderInspoImages` only when the painter clicks
 * "Save order".
 */
interface Props {
  rows: ReadonlyArray<InspoImage>;
  onClose: () => void;
}

export function ManageInspoModal({ rows, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[]>(
    () => rows.map((r) => r.id),
  );
  const [dragId, setDragId] = useState<string | null>(null);

  // Close on Escape — the standard modal contract.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Resync local order if rows change underneath (e.g., painter
  // deletes a row, the parent re-renders and passes a new array).
  useEffect(() => {
    setLocalOrder(rows.map((r) => r.id));
  }, [rows]);

  const rowsById = new Map(rows.map((r) => [r.id, r]));
  const orderedRows = localOrder
    .map((id) => rowsById.get(id))
    .filter((r): r is InspoImage => r != null);

  const onToggle = (id: string, nextDisplayed: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await toggleInspoDisplay({
        id,
        isDisplayed: nextDisplayed,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const onDelete = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await deleteInspoImage({ id });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Drop from local order immediately so the row stops rendering
      // before the server refresh lands.
      setLocalOrder((prev) => prev.filter((x) => x !== id));
      router.refresh();
    });
  };

  const onSaveOrder = () => {
    setError(null);
    if (localOrder.length === 0) {
      onClose();
      return;
    }
    // Detect whether the order actually changed — saves a no-op
    // round-trip when the painter opens + closes the modal without
    // touching anything.
    const currentOrder = rows.map((r) => r.id);
    const changed = localOrder.some(
      (id, idx) => currentOrder[idx] !== id,
    );
    if (!changed) {
      onClose();
      return;
    }
    startTransition(async () => {
      const res = await reorderInspoImages({ orderedIds: localOrder });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  const onDragStart = (id: string) => () => {
    setDragId(id);
  };

  const onDragOver = (id: string) => (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    if (!dragId || dragId === id) return;
    setLocalOrder((prev) => {
      const next = prev.slice();
      const from = next.indexOf(dragId);
      const to = next.indexOf(id);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
  };

  const onDragEnd = () => {
    setDragId(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage inspo gallery"
      className={clsx(
        "fixed inset-0 z-50 flex items-stretch justify-center",
        // P14.8 — drop the backdrop padding on mobile so the modal
        // panel takes the full viewport; restore desktop padding at
        // `sm:` so the panel still floats with a backdrop margin.
        "bg-black/70 sm:items-center sm:p-4",
      )}
      onClick={(e) => {
        // Click-outside closes; clicks inside the panel bubble up to
        // here, so we check the target.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={clsx(
          "frame bg-[var(--color-bg-panel)]",
          // P14.8 — full-screen on mobile (no max width / height
          // bound), constrained dialog at `sm:` and up.
          "w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] flex flex-col",
        )}
      >
        <header className="flex items-center justify-between gap-2 p-4 border-b border-[var(--color-border-strong)]">
          <h3 className="font-mono text-sm uppercase tracking-wider text-[var(--color-fg)]">
            Manage inspo
          </h3>
          <div className="inline-flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onSaveOrder}
              disabled={isPending}
            >
              Save order
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isPending}
            >
              Close
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {orderedRows.length === 0 ? (
            <p className="text-sm font-sans text-[var(--color-fg-muted)]">
              No inspo images yet. Paste a URL below the gallery to
              start.
            </p>
          ) : (
            <ul aria-label="Manage inspo rows" className="space-y-2">
              {orderedRows.map((row) => (
                <li
                  key={row.id}
                  draggable
                  onDragStart={onDragStart(row.id)}
                  onDragOver={onDragOver(row.id)}
                  onDragEnd={onDragEnd}
                  data-inspo-id={row.id}
                  className={clsx(
                    "frame p-2 flex items-center gap-3",
                    dragId === row.id && "opacity-50",
                    !row.isDisplayed && "opacity-70",
                  )}
                >
                  <span
                    aria-hidden
                    className="font-mono text-2xs text-[var(--color-fg-muted)] cursor-grab select-none"
                    title="Drag to reorder"
                  >
                    ⋮⋮
                  </span>
                  <img
                    src={row.url}
                    alt={row.altText ?? "Inspo reference"}
                    loading="lazy"
                    className="w-14 h-14 object-cover frame"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-xs text-[var(--color-fg)] truncate">
                      {row.url}
                    </p>
                    {row.altText ? (
                      <p className="font-sans text-2xs text-[var(--color-fg-muted)] truncate">
                        {row.altText}
                      </p>
                    ) : null}
                    <p className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                      {row.isDisplayed ? "Showing" : "Hidden"}
                    </p>
                  </div>
                  <div className="inline-flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Button
                      type="button"
                      variant={row.isDisplayed ? "warning" : "success"}
                      size="sm"
                      onClick={() => onToggle(row.id, !row.isDisplayed)}
                      disabled={isPending}
                    >
                      {row.isDisplayed ? "Hide" : "Show"}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => onDelete(row.id)}
                      disabled={isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error ? (
            <p
              role="alert"
              className="mt-3 text-2xs font-mono text-[var(--color-red)]"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
