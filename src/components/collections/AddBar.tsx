"use client";

import { useState, useTransition } from "react";
import {
  createWishlistItem,
  scrapeAndCreateWishlistItem,
} from "@/lib/actions/wishlist";
import { Button } from "@/components/ui/Button";
import { LogTag } from "@/components/ui/LogTag";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { WishlistKind } from "@/db/schema";

const URL_RE = /^https?:\/\//i;

/**
 * COLLECTIONS add bar. Adds a row to the PAINT or MODEL collection.
 *
 * - A Paint / Model toggle picks which table the entry lands in (the
 *   chosen kind is passed explicitly so the entry isn't left to the
 *   title heuristic).
 * - Pasting a vendor URL → automated scrape populates the row.
 * - Typing a plain title → a minimal manual row the painter can flesh out
 *   inline afterwards.
 *
 * The Add button uses the shared app Button (success variant) so it
 * matches every other primary action in the app.
 */
export function AddBar() {
  const [kind, setKind] = useState<WishlistKind>("paint");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUpgradeUrl(null);
    setNotice(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Type a name or paste a vendor URL.");
      return;
    }
    if (URL_RE.test(trimmed)) {
      try {
        new URL(trimmed);
      } catch {
        setError("That doesn't look like a valid URL.");
        return;
      }
      setNotice("Scraping vendor page…");
      startTransition(async () => {
        const result = await scrapeAndCreateWishlistItem({ url: trimmed });
        setNotice(null);
        if (result.ok === false) {
          setError(result.error);
          setUpgradeUrl(result.upgradeUrl ?? null);
          return;
        }
        // The scrape infers kind from the page; if the painter explicitly
        // picked the other table, re-file it to honour the choice.
        if (result.data.kind !== kind) {
          const { updateWishlistItem } = await import("@/lib/actions/wishlist");
          await updateWishlistItem({ id: result.data.id, kind });
        }
        setValue("");
      });
      return;
    }
    startTransition(async () => {
      const result = await createWishlistItem({ title: trimmed, kind });
      if (result.ok === false) {
        setError(result.error);
        setUpgradeUrl(result.upgradeUrl ?? null);
        return;
      }
      setValue("");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1 w-full md:max-w-2xl">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <SegmentedControl
          ariaLabel="Add to which collection"
          options={[
            { value: "paint", label: "Paint" },
            { value: "model", label: "Model" },
          ]}
          value={kind}
          onChange={setKind}
        />
        <label
          className="flex-1 min-w-0 rounded-sm border flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-elevated)] focus-within:border-[var(--color-cyan)] transition-colors motion-reduce:transition-none"
          style={{
            borderColor:
              "color-mix(in srgb, var(--color-cyan) 22%, var(--color-border))",
          }}
        >
          <span aria-hidden className="font-mono text-sm text-[var(--color-cyan)]">
            ▸
          </span>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={500}
            aria-label={`Add ${kind} to collection`}
            placeholder="Paste a vendor URL — or type a name to add manually"
            className="flex-1 min-w-0 bg-transparent font-mono text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none border-0 p-0"
          />
        </label>
        <Button
          type="submit"
          disabled={isPending || value.trim().length === 0}
          aria-label="Add to collection"
          variant="success"
          size="sm"
        >
          {isPending ? "…" : "Add"}
        </Button>
      </div>
      {notice ? (
        <p className="text-xs font-mono text-[var(--color-amber)]">{notice}</p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-xs font-mono text-[var(--color-red)] flex-wrap"
        >
          <LogTag variant="err" />
          <span>{error}</span>
          {upgradeUrl ? (
            <a
              href={upgradeUrl}
              className="font-mono text-2xs uppercase tracking-wider text-[var(--color-green)] underline-offset-2 hover:underline whitespace-nowrap"
            >
              Upgrade →
            </a>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
