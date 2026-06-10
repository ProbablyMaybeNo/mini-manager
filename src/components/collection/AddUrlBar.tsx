"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import {
  createWishlistItem,
  scrapeAndCreateWishlistItem,
  updateWishlistItem,
} from "@/lib/actions/wishlist";
import { Button } from "@/components/ui/Button";
import type { WishlistKind } from "@/db/schema";

const URL_RE = /^https?:\/\//i;

/**
 * COLLECTION header add bar (REBUILD_SPEC §8) — `PASTE URL TO ADD PAINTS
 * AND MODELS` input + PAINT/MODEL type dropdown + ADD, docked top-right
 * of the page header. Feeds the existing scraper/import pipeline:
 *
 * - a vendor URL → `scrapeAndCreateWishlistItem` (auto-filled row); the
 *   scrape infers kind from the page, so if the painter explicitly chose
 *   the other table the row is re-filed to honour the choice.
 * - a plain name → `createWishlistItem` manual row in the chosen table.
 */
export function AddUrlBar() {
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
      setError("PASTE A VENDOR URL — OR TYPE A NAME TO ADD MANUALLY.");
      return;
    }
    if (URL_RE.test(trimmed)) {
      try {
        new URL(trimmed);
      } catch {
        setError("THAT DOESN'T LOOK LIKE A VALID URL.");
        return;
      }
      setNotice("SCRAPING VENDOR PAGE…");
      startTransition(async () => {
        const result = await scrapeAndCreateWishlistItem({ url: trimmed });
        setNotice(null);
        if (result.ok === false) {
          setError(result.error);
          setUpgradeUrl(result.upgradeUrl ?? null);
          return;
        }
        if (result.data.kind !== kind) {
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
    <form
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-1 md:w-auto md:min-w-[480px]"
    >
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <label
          className={clsx(
            "flex min-w-0 flex-1 items-center gap-2 border px-3 py-2",
            "border-[color-mix(in_srgb,var(--color-cyan)_45%,transparent)]",
            "bg-[var(--color-bg-elevated)] transition-colors motion-reduce:transition-none",
            "focus-within:border-[var(--color-cyan)]",
          )}
        >
          <span aria-hidden className="font-mono text-sm text-[var(--color-cyan)]">
            ▸
          </span>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={500}
            aria-label="Paste a URL or type a name to add paints and models"
            placeholder="PASTE URL TO ADD PAINTS AND MODELS"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
          />
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as WishlistKind)}
          aria-label="Add as paint or model"
          className={clsx(
            "min-h-11 cursor-pointer border bg-[var(--color-bg-elevated)] px-2 font-mono text-sm uppercase tracking-wider text-[var(--color-cyan)] md:min-h-9",
            "border-[color-mix(in_srgb,var(--color-cyan)_45%,transparent)]",
            "focus:outline-none focus-visible:[box-shadow:0_0_0_2px_var(--color-cyan)]",
          )}
        >
          <option value="paint">PAINT</option>
          <option value="model">MODEL</option>
        </select>
        <Button
          type="submit"
          disabled={isPending || value.trim().length === 0}
          variant="primary"
          size="sm"
        >
          {isPending ? "…" : "ADD"}
        </Button>
      </div>
      {notice ? (
        <p role="status" className="font-mono text-xs text-[var(--color-yellow)]">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="flex flex-wrap items-start gap-2 font-mono text-xs text-[var(--color-red)]"
        >
          <span aria-hidden>[ERR]</span>
          <span>{error}</span>
          {upgradeUrl ? (
            <a
              href={upgradeUrl}
              className="whitespace-nowrap font-mono text-2xs uppercase tracking-wider text-[var(--color-green)] underline-offset-2 hover:underline"
            >
              UPGRADE →
            </a>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
