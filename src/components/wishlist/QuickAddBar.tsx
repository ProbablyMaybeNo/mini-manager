"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import {
  createWishlistItem,
  scrapeAndCreateWishlistItem,
} from "@/lib/actions/wishlist";

const URL_RE = /^https?:\/\//i;

/**
 * Wishlist quick-add bar. URL input → vendor scraper (P2.5). Otherwise
 * → minimal manual row from the title only. The scrape can take a few
 * seconds; we show a "scraping…" placeholder so the user knows
 * something is happening.
 */
export function QuickAddBar() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Type a title or paste a vendor URL.");
      return;
    }
    if (URL_RE.test(trimmed)) {
      try {
        // Validate format before spinning up a server round-trip.
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
          return;
        }
        setValue("");
      });
      return;
    }
    startTransition(async () => {
      const result = await createWishlistItem({ title: trimmed });
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      setValue("");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1 w-full md:max-w-2xl">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={500}
          aria-label="Quick add wishlist item"
          placeholder="Paste a vendor URL — or type a title to add manually"
          className={clsx(
            "flex-1 min-w-0 px-3 py-2 font-mono text-sm bg-[var(--color-bg-elevated)] frame",
            "focus:border-[var(--color-green)]",
          )}
        />
        <button
          type="submit"
          disabled={isPending || value.trim().length === 0}
          className={clsx(
            "inline-flex items-center px-3 py-2 frame-strong tap-target text-sm font-mono",
            isPending || value.trim().length === 0
              ? "opacity-60 cursor-not-allowed"
              : "hover:bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)] hover:text-[var(--color-green)]",
          )}
        >
          {isPending ? "…" : "+"}
        </button>
      </div>
      {notice ? (
        <p className="text-xs font-mono text-[var(--color-amber)]">{notice}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-mono text-[var(--color-red)]">
          [ ! ] {error}
        </p>
      ) : null}
    </form>
  );
}
