"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { createWishlistItem } from "@/lib/actions/wishlist";

const URL_RE = /^https?:\/\//i;

/**
 * Wishlist quick-add bar. If the input looks like a URL, hand it to the
 * vendor scraper (wired in P2.5 — surfaces a notice for now). Otherwise
 * create a minimal manual row from the title only.
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
      // P2.5 will replace this branch with scrapeAndCreateWishlistItem.
      setNotice("URL scraping coming in P2.5 — creating a placeholder row.");
      startTransition(async () => {
        try {
          const hostname = new URL(trimmed).hostname.replace(/^www\./, "");
          const result = await createWishlistItem({
            title: hostname,
            sourceUrl: trimmed,
            vendor: hostname,
          });
          if (result.ok === false) {
            setError(result.error);
            return;
          }
          setValue("");
        } catch {
          setError("That doesn't look like a valid URL.");
        }
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
