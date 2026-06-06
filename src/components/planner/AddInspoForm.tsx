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

  // Command-prompt input — a leading cyan `▸` caret sits inside a
  // phosphor-bordered field so pasting a URL reads like typing into a
  // terminal. The input itself is borderless (pl-7 clears the caret);
  // the wrapping field carries the frame + focus-within ring.
  const fieldCls = clsx(
    "relative flex items-center",
    "bg-[var(--color-bg-panel)] rounded-sm",
    "border border-[var(--color-border-strong)]",
    "focus-within:outline-2 focus-within:outline-[var(--color-cyan)]",
  );
  const inputCls = clsx(
    "w-full min-w-0 pl-7 pr-3 py-1.5 font-mono text-sm",
    "bg-transparent text-[var(--color-fg)]",
    "focus:outline-none placeholder:text-[var(--color-fg-subtle)]",
  );
  const caret = (
    <span
      aria-hidden
      className="absolute left-3 font-mono text-sm text-[var(--color-cyan)] pointer-events-none select-none"
    >
      ▸
    </span>
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
        <span className={fieldCls}>
          {caret}
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
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
          Alt text (optional)
        </span>
        <span className={fieldCls}>
          {caret}
          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="What's the reference for?"
            maxLength={280}
            className={inputCls}
          />
        </span>
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
