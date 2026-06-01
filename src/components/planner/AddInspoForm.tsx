"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { addInspoImage } from "@/lib/actions/inspoImages";

/**
 * P14.7 — Inspo gallery "Add inspo" form.
 *
 * URL + optional alt text. Form posts to `addInspoImage` server
 * action which validates URL shape only — NEVER fetches the image.
 * Solid-fill Button discipline (P13.1): success variant for the add
 * CTA (CREATE intent), no cyan.
 */
export function AddInspoForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [altText, setAltText] = useState("");

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!url.trim()) {
      setError("Paste a URL");
      return;
    }
    startTransition(async () => {
      const res = await addInspoImage({
        url: url.trim(),
        altText: altText.trim() ? altText.trim() : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setUrl("");
      setAltText("");
      router.refresh();
    });
  };

  const inputCls = clsx(
    "frame px-3 py-1.5 font-sans text-sm",
    "bg-[var(--color-bg-panel)] text-[var(--color-fg)]",
    "border border-[var(--color-border-strong)] rounded-sm",
    "focus:outline-2 focus:outline-[var(--color-accent)]",
  );

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Add inspo image"
      className="flex flex-col gap-2"
    >
      <label className="flex flex-col gap-1">
        <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
          URL
        </span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.pinterest.com/pin/…"
          maxLength={2048}
          autoComplete="off"
          spellCheck={false}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
          Alt text (optional)
        </span>
        <input
          type="text"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          placeholder="What's the reference for?"
          maxLength={280}
          className={inputCls}
        />
      </label>
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="success"
          size="sm"
          disabled={isPending}
        >
          {isPending ? "Adding…" : "Add inspo"}
        </Button>
        {error ? (
          <span
            role="alert"
            className="text-2xs font-mono text-[var(--color-red)]"
          >
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
