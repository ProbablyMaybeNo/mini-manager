"use client";

import { useState, useTransition } from "react";
import {
  createWishlistItem,
  scrapeAndCreateWishlistItem,
} from "@/lib/actions/wishlist";
import { Button } from "@/components/ui/Button";
import { LogTag } from "@/components/ui/LogTag";

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
  // P10.2 — soft inline upgrade affordance when a free-tier cap fires.
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUpgradeUrl(null);
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
          setUpgradeUrl(result.upgradeUrl ?? null);
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
        setUpgradeUrl(result.upgradeUrl ?? null);
        return;
      }
      setValue("");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1 w-full md:max-w-2xl">
      <div className="flex items-center gap-2">
        {/* Terminal command-prompt input — a cyan ▸ prompt + a phosphor-
            tinted frame matching the Library search idiom, so quick-add
            reads as a CLI command line, not a generic SaaS box. */}
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
            aria-label="Quick add wishlist item"
            placeholder="Paste a vendor URL — or type a title to add manually"
            className="flex-1 min-w-0 bg-transparent font-mono text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none border-0 p-0"
          />
        </label>
        <Button
          type="submit"
          disabled={isPending || value.trim().length === 0}
          aria-label="Add wishlist item"
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
        <p role="alert" className="flex items-start gap-2 text-xs font-mono text-[var(--color-red)] flex-wrap">
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
