"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import {
  wishlistCategories,
  wishlistStatuses,
  priorities,
  type WishlistItem,
} from "@/db/schema";
import {
  updateWishlistItem,
  deleteWishlistItem,
} from "@/lib/actions/wishlist";
import { MarkBoughtModal, type MarkBoughtProjectOption } from "./MarkBoughtModal";
import { Button } from "@/components/ui/Button";
import { LogTag } from "@/components/ui/LogTag";

export function WishlistDetailDrawer({
  item,
  projects,
}: {
  item: WishlistItem | null;
  projects: ReadonlyArray<MarkBoughtProjectOption>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<WishlistItem | null>(item);
  const [showBoughtModal, setShowBoughtModal] = useState(false);

  // Reset the draft each time a new item is opened.
  useEffect(() => {
    setDraft(item);
    setError(null);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item || !draft) return null;

  function close() {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.delete("item");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function save() {
    if (!draft || !item) return;
    setError(null);
    const priceDollars =
      draft.price === null || draft.price === undefined ? null : draft.price / 100;
    startTransition(async () => {
      const result = await updateWishlistItem({
        id: item.id,
        title: draft.title,
        vendor: draft.vendor,
        price: priceDollars,
        currency: draft.currency ?? "USD",
        category: draft.category,
        priority: draft.priority,
        projectId: draft.projectId,
        notesMd: draft.notesMd,
        sourceUrl: draft.sourceUrl,
      });
      if (result.ok === false) setError(result.error);
    });
  }

  function openBoughtModal() {
    setShowBoughtModal(true);
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteWishlistItem({ id: item!.id });
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      close();
    });
  }

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 right-0 z-50 w-full md:w-[440px] bg-[var(--color-bg-panel)]",
        "border-l border-[var(--color-border-strong)] shadow-2xl",
        "flex flex-col pb-20 md:pb-0",
      )}
      aria-label={`Wishlist item ${item.title}`}
    >
      <header className="flex items-center justify-between gap-2 p-4 border-b border-[var(--color-border)]">
        <h2 className="font-mono text-base text-[var(--color-fg)] truncate">
          {item.title}
        </h2>
        <button
          type="button"
          onClick={close}
          className="text-base font-mono px-2 py-1 text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target"
          aria-label="Close detail drawer"
        >
          ×
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <Field label="Title">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="Vendor">
          <input
            value={draft.vendor ?? ""}
            onChange={(e) => setDraft({ ...draft, vendor: e.target.value || null })}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-[1fr_80px] gap-2">
          <Field label="Price">
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft.price === null ? "" : (draft.price / 100).toFixed(2)}
              onChange={(e) => {
                const v = e.target.value;
                setDraft({
                  ...draft,
                  price: v === "" ? null : Math.round(Number(v) * 100),
                });
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Currency">
            <input
              value={draft.currency ?? "USD"}
              onChange={(e) =>
                setDraft({ ...draft, currency: e.target.value.toUpperCase().slice(0, 3) })
              }
              maxLength={3}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Source URL">
          <input
            value={draft.sourceUrl ?? ""}
            onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value || null })}
            className={inputClass}
          />
        </Field>

        <Field label="Category">
          <select
            value={draft.category}
            onChange={(e) =>
              setDraft({ ...draft, category: e.target.value as typeof draft.category })
            }
            className={inputClass}
          >
            {wishlistCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority">
          <select
            value={draft.priority}
            onChange={(e) =>
              setDraft({ ...draft, priority: e.target.value as typeof draft.priority })
            }
            className={inputClass}
          >
            {priorities.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select
            value={draft.status}
            onChange={(e) =>
              setDraft({ ...draft, status: e.target.value as typeof draft.status })
            }
            className={inputClass}
          >
            {wishlistStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Project">
          <select
            value={draft.projectId ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, projectId: e.target.value || null })
            }
            className={inputClass}
          >
            <option value="">(none)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes (Markdown)">
          <textarea
            rows={4}
            value={draft.notesMd ?? ""}
            onChange={(e) => setDraft({ ...draft, notesMd: e.target.value || null })}
            className={clsx(inputClass, "font-sans text-sm")}
          />
        </Field>

        {error ? (
          <p role="alert" className="flex items-start gap-2 text-xs font-mono text-[var(--color-red)]">
            <LogTag variant="err" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>

      <footer className="flex items-center justify-between gap-2 p-4 border-t border-[var(--color-border)]">
        <Button
          type="button"
          onClick={remove}
          disabled={isPending}
          variant="danger"
          size="sm"
        >
          Delete
        </Button>
        <div className="flex items-center gap-2">
          {item.status !== "PURCHASED" ? (
            <Button
              type="button"
              onClick={openBoughtModal}
              disabled={isPending}
              variant="secondary"
              size="sm"
            >
              ✓ Mark bought
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={save}
            disabled={isPending}
            variant="success"
            size="sm"
          >
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </footer>
      {showBoughtModal ? (
        <MarkBoughtModal
          open
          onClose={() => setShowBoughtModal(false)}
          itemId={item.id}
          title={item.title}
          projects={projects}
        />
      ) : null}
    </aside>
  );
}

const inputClass =
  "w-full px-2 py-1.5 frame bg-[var(--color-bg-elevated)] font-mono text-sm focus:border-[var(--color-accent)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
      <span>{label}</span>
      {children}
    </label>
  );
}
